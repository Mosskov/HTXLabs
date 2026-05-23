// Pure replenishment math for the request-driven hint bucket.
//
// `lastAt === null` (timer not running, full bucket, or fresh phase) means no
// grants. `replenishMs <= 0` (author disabled the timer) means no grants.
// Otherwise we compute how many full `replenishMs` intervals have elapsed since
// the anchor, cap the total at `cap`, and return the grant count + the new
// anchor (preserving the fractional remainder so the next interval doesn't
// reset on dispatch).

export interface ReplenishGrants {
  /** Number of tokens to add (clamped so `current + grants <= cap`). */
  grants: number;
  /** New anchor — `lastAt + grants * replenishMs`. Equals the input `lastAt`
   *  when `grants === 0`, so the caller can use this as the next dispatch's
   *  `fromLastReplenishAt` guard without special-casing. */
  newLastAt: number;
}

export function computeReplenishGrants(
  now: number,
  lastAt: number | null,
  replenishMs: number,
  current: number,
  cap: number,
): ReplenishGrants {
  if (lastAt === null || replenishMs <= 0 || current >= cap) {
    return { grants: 0, newLastAt: lastAt ?? now };
  }
  const elapsed = now - lastAt;
  if (elapsed < replenishMs) {
    return { grants: 0, newLastAt: lastAt };
  }
  const raw = Math.floor(elapsed / replenishMs);
  const capped = Math.min(raw, cap - current);
  return { grants: capped, newLastAt: lastAt + capped * replenishMs };
}
