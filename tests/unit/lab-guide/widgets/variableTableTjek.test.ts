// @vitest-environment node
// Pure-helper unit tests for variableTableTjek. Covers the per-cell lock/flash
// rules documented in VariableTable's header: correct+filled locks and flashes
// emerald, wrong+filled flashes rose without locking, empty is ignored, and a
// stale lock is dropped (rose-flashed only when the value regressed rather than
// being cleared).
import type { CorrectnessReport } from '@/lab-guide/widgets/variableTableCorrectness';
import { computeTjekOutcome, deriveTjekDimReason } from '@/lab-guide/widgets/variableTableTjek';
import type { VariableTableValues } from '@/lab-guide/widgets/variableTableValues';
import { describe, expect, it } from 'vitest';

const blank = { name: '', symbol: '', unit: '' };

function values(iv: Partial<typeof blank>[]): VariableTableValues {
  return { iv: iv.map((r) => ({ ...blank, ...r })), dv: [], constants: [] };
}

// Only `symbol` is configured, so `name` and `unit` must be ignored throughout.
const expected = { iv: [{ symbol: 'h' }], dv: [], constants: [] };

const matched: CorrectnessReport = {
  iv: [{ status: 'matched', expectedIndex: 0, studentIndex: 0 }],
  dv: [],
};
const symbolWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'mismatch' } } }],
  dv: [],
};

describe('computeTjekOutcome', () => {
  it('locks and emerald-flashes a correct filled cell', () => {
    const out = computeTjekOutcome({ values: values([{ symbol: 'h' }]), errors: matched, expected, locks: {} });
    expect(out.newlyLocked).toEqual(['iv.0.symbol']);
    expect(out.newlyUnlocked).toEqual([]);
    expect(out.flashKeys).toEqual({ 'iv.0.symbol': 'correct' });
  });

  it('rose-flashes a wrong filled cell without locking it', () => {
    const out = computeTjekOutcome({ values: values([{ symbol: 'x' }]), errors: symbolWrong, expected, locks: {} });
    expect(out.newlyLocked).toEqual([]);
    expect(out.flashKeys).toEqual({ 'iv.0.symbol': 'wrong' });
  });

  it('ignores an empty cell entirely', () => {
    const out = computeTjekOutcome({ values: values([{}]), errors: symbolWrong, expected, locks: {} });
    expect(out.newlyLocked).toEqual([]);
    expect(out.newlyUnlocked).toEqual([]);
    expect(out.flashKeys).toEqual({});
  });

  it('drops a stale lock silently when the value was cleared', () => {
    // Cleared, not wrong — so no flash, but the lock must not survive.
    const out = computeTjekOutcome({
      values: values([{}]),
      errors: symbolWrong,
      expected,
      locks: { 'iv.0.symbol': true },
    });
    expect(out.newlyUnlocked).toEqual(['iv.0.symbol']);
    expect(out.flashKeys).toEqual({});
  });

  it('is a no-op for a locked cell that is still correct', () => {
    const out = computeTjekOutcome({
      values: values([{ symbol: 'h' }]),
      errors: matched,
      expected,
      locks: { 'iv.0.symbol': true },
    });
    expect(out.newlyLocked).toEqual([]);
    expect(out.newlyUnlocked).toEqual([]);
    expect(out.flashKeys).toEqual({});
  });

  it('drops the lock and rose-flashes a regressed locked cell', () => {
    const out = computeTjekOutcome({
      values: values([{ symbol: 'x' }]),
      errors: symbolWrong,
      expected,
      locks: { 'iv.0.symbol': true },
    });
    expect(out.newlyUnlocked).toEqual(['iv.0.symbol']);
    expect(out.flashKeys).toEqual({ 'iv.0.symbol': 'wrong' });
  });

  it('ignores cells the author did not configure', () => {
    const out = computeTjekOutcome({
      values: values([{ name: 'højde', symbol: 'h', unit: 'm' }]),
      errors: matched,
      expected,
      locks: {},
    });
    // Only `symbol` is configured — `name` and `unit` produce no keys.
    expect(Object.keys(out.flashKeys)).toEqual(['iv.0.symbol']);
  });

  it('ignores rows the matcher reports as missing', () => {
    const missing: CorrectnessReport = { iv: [{ status: 'missing', expectedIndex: 0 }], dv: [] };
    const out = computeTjekOutcome({ values: values([]), errors: missing, expected, locks: {} });
    expect(out.flashKeys).toEqual({});
  });
});

describe('deriveTjekDimReason', () => {
  const allClean = { iv: true, dv: true, constants: true };
  const allDirty = { iv: false, dv: false, constants: false };
  const filledValues = values([{ symbol: 'h' }]);

  it('is null when no answer key is configured', () => {
    expect(deriveTjekDimReason(values([]), allDirty, false, false)).toBeNull();
  });
  it("is 'empty' when nothing has been entered anywhere", () => {
    expect(deriveTjekDimReason(values([{}]), allDirty, false, true)).toBe('empty');
  });
  it("is 'clean' when every section still matches the last snapshot", () => {
    expect(deriveTjekDimReason(filledValues, allClean, true, true)).toBe('clean');
  });
  it('is null when a section has been edited since the last Tjek', () => {
    expect(deriveTjekDimReason(filledValues, allDirty, true, true)).toBeNull();
  });
  it("prefers 'empty' over 'clean'", () => {
    expect(deriveTjekDimReason(values([{}]), allClean, true, true)).toBe('empty');
  });
});
