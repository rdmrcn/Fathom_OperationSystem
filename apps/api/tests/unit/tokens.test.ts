import { describe, expect, it } from "vitest";
import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from "../../src/modules/auth/tokens.js";

const config = { secret: "x".repeat(48), accessTtlSeconds: 60, refreshTtlDays: 7 };

describe("tokens", () => {
  it("round-trips an access token", () => {
    const token = signAccessToken({ sub: "12", role: "admin", name: "Reha", email: "a@b.c" }, config);
    const claims = verifyAccessToken(token, config);
    expect(claims).toMatchObject({ sub: "12", role: "admin", email: "a@b.c" });
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = signAccessToken({ sub: "1", role: "member", name: "A", email: "a@b.c" }, config);
    expect(verifyAccessToken(token, { ...config, secret: "y".repeat(48) })).toBeNull();
  });

  it("hashes refresh tokens with SHA-256", () => {
    const { token, hash } = generateRefreshToken();
    expect(hash).toBe(hashRefreshToken(token));
    expect(hash).toHaveLength(64);
    expect(token).not.toBe(hash);
  });
});
