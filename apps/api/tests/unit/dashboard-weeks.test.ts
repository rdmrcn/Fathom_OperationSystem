import { describe, expect, it } from "vitest";
import { startOfIsoWeek, weekStarts } from "../../src/modules/dashboard/service.js";

describe("ISO weeks", () => {
  it("starts the week on Monday", () => {
    // 8 Nov 2026 is a Sunday.
    const start = startOfIsoWeek(new Date(Date.UTC(2026, 10, 8)));
    expect(start.toISOString().slice(0, 10)).toBe("2026-11-02");
  });

  it("returns eight consecutive Mondays ending this week", () => {
    const weeks = weekStarts(8, new Date(Date.UTC(2026, 10, 8)));
    expect(weeks).toHaveLength(8);
    expect(weeks[0].toISOString().slice(0, 10)).toBe("2026-09-14");
    expect(weeks[7].toISOString().slice(0, 10)).toBe("2026-11-02");
  });
});
