let next = -1;

/** Negative ids for optimistic chat messages (never collide with SQL Server identities). */
export function nextTempId(): number {
  next -= 1;
  return next;
}
