import { describe, expect, it } from "vitest";
import { matchCommands } from "./commands";

describe("matchCommands", () => {
  it("returns the full palette when the query is empty", () => {
    expect(matchCommands("").map((c) => c.id)).toContain("today");
  });

  it("matches standup wording to Today", () => {
    expect(matchCommands("standup").map((c) => c.id)).toEqual(["today"]);
  });
});
