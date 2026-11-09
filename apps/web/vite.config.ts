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
    proxy: { "/api": { target: process.env.API_PROXY_TARGET ?? "http://localhost:4000", changeOrigin: true } },
  },
  preview: { port: 5173 },
  build: { chunkSizeWarningLimit: 900 },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
