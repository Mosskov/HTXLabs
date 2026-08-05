// @vitest-environment node
// Pure-helper unit tests for variableTableLocks. Covers the rule documented in
// the module header: a cell is locked-and-correct only when a lock entry exists
// AND the current matcher report still pairs its expected row to a student row
// whose value passes for that cell — so a stale lock never resurrects a gate.
import type { CorrectnessReport } from '@/lab-guide/widgets/variableTableCorrectness';
import {
  cellLockedAndCorrect,
  cellLockedForStudent,
  lockKeyForStudent,
  sectionFullyLockedCorrect,
} from '@/lab-guide/widgets/variableTableLocks';
import { describe, expect, it } from 'vitest';

const matched: CorrectnessReport = {
  iv: [{ status: 'matched', expectedIndex: 0, studentIndex: 0 }],
  dv: [],
};

const partialSymbolWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'mismatch' } } }],
  dv: [],
};

const missing: CorrectnessReport = {
  iv: [{ status: 'missing', expectedIndex: 0 }],
  dv: [],
};

// Student row 1 paired to expected row 0 — the multi-row reshuffle case.
const crossPaired: CorrectnessReport = {
  iv: [{ status: 'matched', expectedIndex: 0, studentIndex: 1 }],
  dv: [],
};

describe('cellLockedAndCorrect', () => {
  it('is false with no lock entry', () => {
    expect(cellLockedAndCorrect({}, matched, 'iv', 0, 'symbol')).toBe(false);
  });
  it('is true for a locked cell on a fully matched row', () => {
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, matched, 'iv', 0, 'symbol')).toBe(true);
  });
  it('is false for a locked cell that the matcher now reports wrong', () => {
    // Stale lock — the student edited the value after locking it.
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, partialSymbolWrong, 'iv', 0, 'symbol')).toBe(false);
  });
  it('is true for a locked cell with no error on a partial row', () => {
    expect(cellLockedAndCorrect({ 'iv.0.name': true }, partialSymbolWrong, 'iv', 0, 'name')).toBe(true);
  });
  it('is false when the expected row has no student pairing at all', () => {
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, missing, 'iv', 0, 'symbol')).toBe(false);
  });
  it('is false when there is no correctness report', () => {
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, undefined, 'iv', 0, 'symbol')).toBe(false);
  });
});

describe('cellLockedForStudent', () => {
  it('resolves studentIndex to expectedIndex via the matcher', () => {
    expect(cellLockedForStudent({ 'iv.0.symbol': true }, crossPaired, 'iv', 1, 'symbol')).toBe(true);
  });
  it('is false for a student row with no matcher pairing', () => {
    expect(cellLockedForStudent({ 'iv.0.symbol': true }, crossPaired, 'iv', 0, 'symbol')).toBe(false);
  });
});

describe('lockKeyForStudent', () => {
  it('returns the expected-row-keyed lock key for a locked cell', () => {
    expect(lockKeyForStudent({ 'iv.0.symbol': true }, crossPaired, 'iv', 1, 'symbol')).toBe('iv.0.symbol');
  });
  it('returns null when the cell is not locked', () => {
    expect(lockKeyForStudent({}, crossPaired, 'iv', 1, 'symbol')).toBeNull();
  });
  it('returns null for an unpaired student row', () => {
    expect(lockKeyForStudent({ 'iv.0.symbol': true }, missing, 'iv', 0, 'symbol')).toBeNull();
  });
});

describe('sectionFullyLockedCorrect', () => {
  const expectedIv = [{ name: 'højde', symbol: 'h' }];

  it('counts only configured cells and reports full coverage', () => {
    const locks = { 'iv.0.name': true, 'iv.0.symbol': true };
    expect(sectionFullyLockedCorrect(locks, matched, 'iv', expectedIv)).toEqual({
      covered: true,
      configured: 2,
    });
  });
  it('reports partial coverage when one configured cell is unlocked', () => {
    expect(sectionFullyLockedCorrect({ 'iv.0.name': true }, matched, 'iv', expectedIv)).toEqual({
      covered: false,
      configured: 2,
    });
  });
  it('ignores unconfigured cells — unit is absent from the expected entry', () => {
    const locks = { 'iv.0.name': true, 'iv.0.symbol': true };
    // `unit` is not configured, so leaving it unlocked must not break coverage.
    expect(sectionFullyLockedCorrect(locks, matched, 'iv', expectedIv).covered).toBe(true);
  });
  it('reports vacuous coverage for an expected entry with no configured cells', () => {
    expect(sectionFullyLockedCorrect({}, matched, 'iv', [{}])).toEqual({
      covered: true,
      configured: 0,
    });
  });
});
