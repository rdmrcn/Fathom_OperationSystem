import { describe, expect, it } from "vitest";
import { toCount } from "../../src/lib/mappers.js";

describe("toCount", () => {
  it("coerces mssql COUNT shapes to a finite number", () => {
    expect(toCount(3)).toBe(3);
    expect(toCount("4")).toBe(4);
    expect(toCount(5n)).toBe(5);
    expect(toCount(null)).toBe(0);
    expect(toCount(undefined)).toBe(0);
  });
});
