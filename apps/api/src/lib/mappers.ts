/** Converts a DATE/DATETIME2 value coming back from mssql into an ISO string. */
export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new TypeError(`Expected a date, received ${typeof value}`);
}

export function toIsoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

/** DATE columns arrive as UTC-midnight Date objects; keep only the calendar day. */
export function toDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  throw new TypeError(`Expected a date, received ${typeof value}`);
}

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** COUNT / DATEDIFF values from `mssql` can arrive as number, bigint or string. */
export function toCount(value: unknown): number {
  return toNumberOrNull(value) ?? 0;
}
