import { extractTaskKeys, formatTaskKey, parseTaskKey } from "@stratum/shared";
import { describe, expect, it } from "vitest";

describe("task keys", () => {
  it("formats and parses PAY-42", () => {
    expect(formatTaskKey("PAY", 42)).toBe("PAY-42");
    expect(parseTaskKey(" pay-42 ")).toEqual({ projectKey: "PAY", number: 42 });
    expect(parseTaskKey("nope")).toBeNull();
  });

  it("extracts keys from free text", () => {
    expect(extractTaskKeys("Look at PAY-7 and ops-12 please")).toEqual(["PAY-7", "OPS-12"]);
  });
});
