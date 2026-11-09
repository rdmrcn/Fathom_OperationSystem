export function formatTaskKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/** Parses `PAY-42` (case-insensitive, surrounding whitespace allowed). */
export function parseTaskKey(input: string): { projectKey: string; number: number } | null {
  const match = /^\s*([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,7})\s*$/.exec(input);
  if (!match) return null;
  return { projectKey: match[1].toUpperCase(), number: Number(match[2]) };
}

/** Finds every task key mentioned in free text, e.g. "look at PAY-42 and OPS-7". */
export function extractTaskKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(/\b([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,7})\b/g)) {
    keys.add(`${m[1].toUpperCase()}-${Number(m[2])}`);
  }
  return [...keys];
}
