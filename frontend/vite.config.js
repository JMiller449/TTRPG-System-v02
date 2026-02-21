import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
    plugins: [react()],
    resolve: {
        extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    }
});
