import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locates the Vite production build so a single Node process can serve both
 * the API and the React SPA (same origin, no CORS). Returns null in tests /
 * when the web app has not been built.
 */
export function resolveWebDist(metaUrl: string = import.meta.url, cwd = process.cwd()): string | null {
  const here = path.dirname(fileURLToPath(metaUrl));
  const candidates = [
    path.resolve(here, "../../web/dist"),
    path.resolve(here, "../../../web/dist"),
    path.resolve(cwd, "../web/dist"),
    path.resolve(cwd, "apps/web/dist"),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, "index.html"))) ?? null;
}
