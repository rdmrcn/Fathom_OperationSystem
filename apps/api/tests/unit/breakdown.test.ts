import { describe, expect, it } from "vitest";
import { detectFlavour, heuristicBreakdown } from "../../src/modules/assistant/breakdown.js";

describe("heuristicBreakdown", () => {
  it("detects flavours from the goal text", () => {
    expect(detectFlavour("fix the webhook crash")).toBe("bug");
    expect(detectFlavour("migrate the SQL Server schema")).toBe("data");
    expect(detectFlavour("integrate the Stripe API")).toBe("integration");
    expect(detectFlavour("redesign the onboarding UI")).toBe("ui");
    expect(detectFlavour("reduce p95 latency")).toBe("performance");
    expect(detectFlavour("add role-based permissions")).toBe("security");
  });

  it("returns the requested number of independently titled tasks", () => {
    const tasks = heuristicBreakdown("Automate weekly SQL Server backup restore drills", 5);
    expect(tasks).toHaveLength(5);
    expect(new Set(tasks.map((t) => t.title)).size).toBe(5);
    expect(tasks.every((t) => t.title.length >= 8 && t.estimateHours > 0)).toBe(true);
  });
});
