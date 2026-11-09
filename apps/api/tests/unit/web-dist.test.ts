import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveWebDist } from "../../src/lib/web-dist.js";

describe("resolveWebDist", () => {
  it("returns null when no index.html is nearby", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "stratum-nodist-"));
    const fakeModule = path.join(dir, "dist", "index.js");
    expect(resolveWebDist(pathToFileURL(fakeModule).href, dir)).toBeNull();
  });

  it("finds apps/web/dist relative to cwd", () => {
    const root = mkdtempSync(path.join(tmpdir(), "stratum-dist-"));
    const webDist = path.join(root, "apps", "web", "dist");
    mkdirSync(webDist, { recursive: true });
    writeFileSync(path.join(webDist, "index.html"), "<html></html>");
    expect(resolveWebDist(pathToFileURL(path.join(root, "apps/api/dist/index.js")).href, root)).toBe(webDist);
  });
});
