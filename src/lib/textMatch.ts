// Text-matching primitive shared by widgets that need to compare student input
// against an author-supplied set of "variant groups". A group is a set of
// synonyms — matching any one variant satisfies the group. Used by:
//   - FreeTextResponse with `keywordGroups` (scan mode → keyword-count gate)
//   - Future variable-identification widget (exact mode → all-correct gate)

export interface VariantGroup {
  /** Optional stable identifier — useful for per-group hint surfacing later. */
  id?: string;
  /** Synonyms that all satisfy this group; first hit wins. */
  any: string[];
  /** Optional author hint to surface when this group is missing. Engine carries
   * it through to MatchResult; rendering is a widget concern. */
  hint?: string;
}

export type MatchMode =
  | { kind: 'scan'; caseInsensitive?: boolean; wordBoundary?: boolean }
  | { kind: 'exact'; caseInsensitive?: boolean; trim?: boolean };

export interface MatchResult {
  /** Number of groups with at least one variant matched. */
  matchedCount: number;
  /** Total group count (=== groups.length). */
  total: number;
  /** Per-group result, parallel to the input groups[]. */
  perGroup: { id?: string; matched: boolean; hint?: string }[];
}

/** Escape regex metacharacters so a variant string matches literally. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchScan(
  value: string,
  variant: string,
  caseInsensitive: boolean,
  wordBoundary: boolean,
): boolean {
  if (variant === '') return false;
  const flags = caseInsensitive ? 'i' : '';
  const pattern = wordBoundary ? `\\b${escapeRegex(variant)}\\b` : escapeRegex(variant);
  return new RegExp(pattern, flags).test(value);
}

function matchExact(
  value: string,
  variant: string,
  caseInsensitive: boolean,
  trim: boolean,
): boolean {
  const a = trim ? value.trim() : value;
  const b = trim ? variant.trim() : variant;
  return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export function matchVariantGroups(
  value: string,
  groups: VariantGroup[],
  mode: MatchMode,
): MatchResult {
  const perGroup: MatchResult['perGroup'] = groups.map((g) => {
    const matched = g.any.some((variant) => {
      if (mode.kind === 'scan') {
        return matchScan(value, variant, mode.caseInsensitive ?? true, mode.wordBoundary ?? true);
      }
      return matchExact(value, variant, mode.caseInsensitive ?? true, mode.trim ?? true);
    });
    return { id: g.id, matched, hint: g.hint };
  });

  return {
    matchedCount: perGroup.filter((r) => r.matched).length,
    total: groups.length,
    perGroup,
  };
}
