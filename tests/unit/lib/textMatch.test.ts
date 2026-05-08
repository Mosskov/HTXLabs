import { type VariantGroup, matchVariantGroups } from '@/lib/textMatch';
// @vitest-environment node
import { describe, expect, it } from 'vitest';

const scan = { kind: 'scan' as const };
const exact = { kind: 'exact' as const };

describe('matchVariantGroups — scan mode', () => {
  const groups: VariantGroup[] = [
    { id: 'relation', any: ['stiger', 'øges', 'vokser'] },
    { id: 'kraft', any: ['kraft', 'newton'] },
  ];

  it('matches when at least one variant per group appears in the value', () => {
    const r = matchVariantGroups('Når massen øges, stiger kraften i newton.', groups, scan);
    expect(r.matchedCount).toBe(2);
    expect(r.total).toBe(2);
    expect(r.perGroup.map((g) => g.matched)).toEqual([true, true]);
  });

  it('counts a group at most once even when multiple variants hit', () => {
    const r = matchVariantGroups(
      'Kraften stiger og øges og vokser samtidigt — hver gang i newton.',
      groups,
      scan,
    );
    expect(r.matchedCount).toBe(2);
  });

  it('returns matched=false for groups with no hits', () => {
    const r = matchVariantGroups('Helt urelateret tekst.', groups, scan);
    expect(r.matchedCount).toBe(0);
    expect(r.perGroup.every((g) => !g.matched)).toBe(true);
  });

  it('respects word boundaries by default — kraft does not match inside kraftig', () => {
    const r = matchVariantGroups('En kraftig påvirkning stiger.', groups, scan);
    expect(r.perGroup[1].matched).toBe(false); // kraft group
    expect(r.perGroup[0].matched).toBe(true); // relation group (stiger)
  });

  it('matches inside compound when wordBoundary is disabled', () => {
    const r = matchVariantGroups('En kraftig påvirkning.', [{ any: ['kraft'] }], {
      kind: 'scan',
      wordBoundary: false,
    });
    expect(r.matchedCount).toBe(1);
  });

  it('is case-insensitive by default', () => {
    const r = matchVariantGroups('NEWTON er enheden.', [{ any: ['newton'] }], scan);
    expect(r.matchedCount).toBe(1);
  });

  it('honours caseInsensitive: false', () => {
    const r = matchVariantGroups('NEWTON er enheden.', [{ any: ['newton'] }], {
      kind: 'scan',
      caseInsensitive: false,
    });
    expect(r.matchedCount).toBe(0);
  });

  it('escapes regex metacharacters in variants — a.b matches the literal a.b only', () => {
    // 'aXb' must NOT match the variant 'a.b' — the dot is a literal, not a wildcard.
    const r = matchVariantGroups('aXb is the answer', [{ any: ['a.b'] }], scan);
    expect(r.perGroup[0].matched).toBe(false);

    // The literal 'a.b' should match.
    const r2 = matchVariantGroups('see a.b here', [{ any: ['a.b'] }], scan);
    expect(r2.perGroup[0].matched).toBe(true);
  });

  it('skips empty-string variants without throwing', () => {
    const r = matchVariantGroups('anything', [{ any: ['', 'newton'] }], scan);
    // Empty variant doesn't match anything; second variant decides the group.
    expect(r.matchedCount).toBe(0);
    const r2 = matchVariantGroups('newton', [{ any: ['', 'newton'] }], scan);
    expect(r2.matchedCount).toBe(1);
  });
});

describe('matchVariantGroups — exact mode', () => {
  it('matches full-string equality, case-insensitive and trimmed by default', () => {
    const r = matchVariantGroups('  Newton  ', [{ any: ['N', 'Newton', 'newton'] }], exact);
    expect(r.matchedCount).toBe(1);
  });

  it('does not match a substring in exact mode', () => {
    const r = matchVariantGroups('newtons andre lov', [{ any: ['newton'] }], exact);
    expect(r.matchedCount).toBe(0);
  });

  it('honours trim: false', () => {
    const r = matchVariantGroups('  newton  ', [{ any: ['newton'] }], {
      kind: 'exact',
      trim: false,
    });
    expect(r.matchedCount).toBe(0);
  });

  it('honours caseInsensitive: false', () => {
    const r = matchVariantGroups('NEWTON', [{ any: ['newton'] }], {
      kind: 'exact',
      caseInsensitive: false,
    });
    expect(r.matchedCount).toBe(0);
  });
});

describe('matchVariantGroups — empty inputs', () => {
  it('empty value → 0/total with all groups unmatched', () => {
    const r = matchVariantGroups('', [{ any: ['a'] }, { any: ['b'] }], scan);
    expect(r.matchedCount).toBe(0);
    expect(r.total).toBe(2);
    expect(r.perGroup.every((g) => !g.matched)).toBe(true);
  });

  it('empty groups → 0/0', () => {
    const r = matchVariantGroups('anything', [], scan);
    expect(r).toEqual({ matchedCount: 0, total: 0, perGroup: [] });
  });
});

describe('matchVariantGroups — perGroup metadata passthrough', () => {
  it('carries id and hint through to the result, parallel to input', () => {
    const groups: VariantGroup[] = [
      { id: 'relation', any: ['stiger'], hint: 'Brug et ord for hvordan kraften ændrer sig.' },
      { id: 'kraft', any: ['newton'], hint: 'Brug et kraft-relateret ord.' },
    ];
    const r = matchVariantGroups('kraften stiger.', groups, scan);
    expect(r.perGroup[0]).toEqual({
      id: 'relation',
      matched: true,
      hint: 'Brug et ord for hvordan kraften ændrer sig.',
    });
    expect(r.perGroup[1]).toEqual({
      id: 'kraft',
      matched: false,
      hint: 'Brug et kraft-relateret ord.',
    });
  });

  it('omits id/hint when not provided', () => {
    const r = matchVariantGroups('hej', [{ any: ['hej'] }], scan);
    expect(r.perGroup[0]).toEqual({ id: undefined, matched: true, hint: undefined });
  });
});
