/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(rootDir, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:4000",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("error", (_err, _req, res) => {
            const response = res as { headersSent?: boolean; writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void };
            if (!response.headersSent) {
              response.writeHead(502, { "content-type": "application/json" });
              response.end(
                JSON.stringify({
                  error: {
                    code: "api_down",
                    message:
                      "Fathom API is not running. SQL Server must be up (docker compose up -d), then restart npm run dev. The UI is on :5173; the API is on :4000.",
                  },
                }),
              );
            }
          });
        },
      },
    },
  },
  preview: { port: 5173 },
  build: { chunkSizeWarningLimit: 900 },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
