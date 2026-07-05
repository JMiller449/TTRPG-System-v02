import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const userscriptPath = fileURLToPath(
  new URL("../violentmonkey_extension/roll20-bridge.user.js", import.meta.url)
);

function roll20UserscriptPlugin(): Plugin {
  const fileName = "roll20-bridge.user.js";
  const readUserscript = (): string => readFileSync(userscriptPath, "utf8");

  return {
    name: "roll20-userscript",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (pathname !== `/${fileName}`) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/javascript; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache");
        response.end(readUserscript());
      });
    },
    buildStart() {
      this.addWatchFile(userscriptPath);
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName,
        source: readUserscript()
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/ttrpg/" : "/",
  plugins: [react(), roll20UserscriptPlugin()],
  server: {
    port: 5173,
    strictPort: true
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
}));
