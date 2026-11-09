import { describe, expect, it } from "vitest";
import { initials, percent, pluralize } from "./utils";

describe("utils", () => {
  it("initials", () => {
    expect(initials("Reha Demircan")).toBe("RD");
    expect(initials("Elif")).toBe("E");
  });
  it("percent and pluralize", () => {
    expect(percent(5, 14)).toBe(36);
    expect(percent(0, 0)).toBe(0);
    expect(pluralize(1, "task")).toBe("1 task");
    expect(pluralize(3, "task")).toBe("3 tasks");
  });
});
