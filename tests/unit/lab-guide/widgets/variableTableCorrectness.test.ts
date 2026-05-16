// Pure-helper unit tests for variableTableCorrectness. Covers the contract
// documented in the module header: trim policy, case-folding, three-pass
// constants matching, malformed-entry handling.
import {
  type ExpectedConstant,
  type VariableRowErrors,
  evaluateCell,
  evaluateConstants,
  evaluateRow,
  evaluateTable,
  hasNoRowErrors,
  isCorrect,
} from '@/lab-guide/widgets/variableTableCorrectness';
import type { VariableEntry } from '@/lab-guide/widgets/VariableTable';
import { describe, expect, it } from 'vitest';

const emptyEntry: VariableEntry = { name: '', symbol: '', unit: '' };

describe('evaluateCell', () => {
  it('returns undefined when accepted is undefined (cell not under check)', () => {
    expect(evaluateCell('anything', undefined, false)).toBeUndefined();
    expect(evaluateCell('', undefined, true)).toBeUndefined();
  });

  it('returns {type:"empty"} on blank value (case-sensitive cell)', () => {
    expect(evaluateCell('', ['h'], true)).toEqual({ type: 'empty' });
    expect(evaluateCell('   ', ['h'], true)).toEqual({ type: 'empty' });
  });

  it('returns {type:"empty"} on blank value (case-insensitive cell)', () => {
    expect(evaluateCell('', ['højde'], false)).toEqual({ type: 'empty' });
  });

  it('case-sensitive: exact match → undefined', () => {
    expect(evaluateCell('h', ['h'], true)).toBeUndefined();
    expect(evaluateCell('m/s²', ['m/s²', 'm/s^2'], true)).toBeUndefined();
  });

  it('case-sensitive: case-only mismatch → "case-mismatch"', () => {
    expect(evaluateCell('M', ['m'], true)).toEqual({ type: 'case-mismatch' });
    expect(evaluateCell('H', ['h'], true)).toEqual({ type: 'case-mismatch' });
  });

  it('case-sensitive: non-match → "mismatch"', () => {
    expect(evaluateCell('kg', ['m'], true)).toEqual({ type: 'mismatch' });
  });

  it('case-insensitive: exact match → undefined', () => {
    expect(evaluateCell('højde', ['højde'], false)).toBeUndefined();
  });

  it('case-insensitive: case-folded match → undefined (never reports case-mismatch)', () => {
    expect(evaluateCell('Højde', ['højde'], false)).toBeUndefined();
    expect(evaluateCell('HØJDE', ['højde'], false)).toBeUndefined();
  });

  it('case-insensitive: non-match → "mismatch"', () => {
    expect(evaluateCell('tid', ['højde'], false)).toEqual({ type: 'mismatch' });
  });

  it('trims leading/trailing whitespace but not internal', () => {
    expect(evaluateCell('  h  ', ['h'], true)).toBeUndefined();
    expect(evaluateCell('h h', ['h'], true)).toEqual({ type: 'mismatch' });
  });

  it('accepts any synonym in the array', () => {
    expect(evaluateCell('faldhøjde', ['højde', 'faldhøjde'], false)).toBeUndefined();
    expect(evaluateCell('højde', ['højde', 'faldhøjde'], false)).toBeUndefined();
  });
});

describe('hasNoRowErrors', () => {
  it('returns true on empty errors object', () => {
    expect(hasNoRowErrors({})).toBe(true);
  });

  it('returns false on any error key set', () => {
    expect(hasNoRowErrors({ name: { type: 'empty' } })).toBe(false);
    expect(hasNoRowErrors({ unit: { type: 'case-mismatch' } })).toBe(false);
  });
});

describe('evaluateRow', () => {
  it('all correct → {}', () => {
    expect(
      evaluateRow(
        { name: 'højde', symbol: 'h', unit: 'm' },
        { name: 'højde', symbol: 'h', unit: 'm' },
      ),
    ).toEqual({});
  });

  it('one wrong cell → only that key set', () => {
    expect(
      evaluateRow(
        { name: 'højde', symbol: 'x', unit: 'm' },
        { name: 'højde', symbol: 'h', unit: 'm' },
      ),
    ).toEqual({ symbol: { type: 'mismatch' } });
  });

  it('expected.unit omitted → no unit key in result regardless of input', () => {
    expect(
      evaluateRow(
        { name: 'højde', symbol: 'h', unit: 'whatever' },
        { name: 'højde', symbol: 'h' },
      ),
    ).toEqual({});
    expect(
      evaluateRow(
        { name: 'højde', symbol: 'h', unit: '' },
        { name: 'højde', symbol: 'h' },
      ),
    ).toEqual({});
  });

  it('all three cells omitted → {} (vacuously correct)', () => {
    expect(evaluateRow(emptyEntry, {})).toEqual({});
    expect(evaluateRow({ name: 'whatever', symbol: 'x', unit: 'kg' }, {})).toEqual({});
  });

  it('case-mismatch surfaces on symbol/unit only', () => {
    const errors = evaluateRow(
      { name: 'Højde', symbol: 'H', unit: 'M' },
      { name: 'højde', symbol: 'h', unit: 'm' },
    );
    expect(errors.name).toBeUndefined(); // case-folded match
    expect(errors.symbol).toEqual({ type: 'case-mismatch' });
    expect(errors.unit).toEqual({ type: 'case-mismatch' });
  });
});

describe('evaluateConstants', () => {
  const G_SPEC: ExpectedConstant = {
    name: 'tyngdeacceleration',
    symbol: 'g',
    unit: 'm/s²',
  };

  it('single expected, exact student row → matched', () => {
    const result = evaluateConstants(
      [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
      [G_SPEC],
    );
    expect(result).toEqual([{ status: 'matched', expectedIndex: 0, studentIndex: 0 }]);
  });

  it('single expected, matching symbol but wrong name → partial with errors.name', () => {
    const result = evaluateConstants(
      [{ name: 'gravity', symbol: 'g', unit: 'm/s²' }],
      [G_SPEC],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'partial', expectedIndex: 0, studentIndex: 0 });
    if (result[0].status === 'partial') {
      expect(result[0].errors.name).toEqual({ type: 'mismatch' });
    }
  });

  it('no student row mentions the symbol → missing', () => {
    const result = evaluateConstants([{ name: 'fart', symbol: 'v', unit: 'm/s' }], [G_SPEC]);
    expect(result).toEqual([{ status: 'missing', expectedIndex: 0 }]);
  });

  it('empty student rows → missing', () => {
    expect(evaluateConstants([], [G_SPEC])).toEqual([
      { status: 'missing', expectedIndex: 0 },
    ]);
  });

  it('duplicate-symbol student rows: matcher picks the full match first', () => {
    // Row A: symbol exact, name wrong (partial). Row B: fully correct.
    // Pass 1 picks B (full match); A is left unused.
    const result = evaluateConstants(
      [
        { name: 'gravity', symbol: 'g', unit: 'm/s²' }, // partial
        { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }, // full
      ],
      [G_SPEC],
    );
    expect(result).toEqual([{ status: 'matched', expectedIndex: 0, studentIndex: 1 }]);
  });

  it('two expected constants, three student rows → each expected gets a distinct row', () => {
    const expected: ExpectedConstant[] = [
      { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
      { name: 'masse', symbol: 'm', unit: 'kg' },
    ];
    const student: VariableEntry[] = [
      { name: 'masse', symbol: 'm', unit: 'kg' },
      { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
      { name: 'extra', symbol: 'x', unit: 'foo' },
    ];
    const result = evaluateConstants(student, expected);
    expect(result).toHaveLength(2);
    const byIdx = new Map(result.map((r) => [r.expectedIndex, r]));
    expect(byIdx.get(0)).toMatchObject({ status: 'matched', studentIndex: 1 });
    expect(byIdx.get(1)).toMatchObject({ status: 'matched', studentIndex: 0 });
  });

  it('expected with only `name` set: matcher uses name as the key', () => {
    const expected: ExpectedConstant[] = [{ name: 'gravity' }];
    const student: VariableEntry[] = [{ name: 'gravity', symbol: 'g', unit: 'm/s²' }];
    expect(evaluateConstants(student, expected)).toEqual([
      { status: 'matched', expectedIndex: 0, studentIndex: 0 },
    ]);
  });

  it('expected with neither name nor symbol → entry is silently skipped (not missing)', () => {
    // Cast to bypass the discriminated-union TS check — this is the runtime
    // safety net for a programmer error that slipped past the type system.
    const malformed = [{} as ExpectedConstant];
    expect(evaluateConstants([], malformed)).toEqual([]);
    expect(
      evaluateConstants([{ name: 'something', symbol: 's', unit: 'x' }], malformed),
    ).toEqual([]);
  });

  it('pass-2 priority: exact key match wins over case-insensitive within partial pass', () => {
    // Row A has symbol "G" (case-only-wrong, name wrong). Row B has symbol
    // "g" (exact key, name wrong). Pass 2a should pick B; A is left unmatched.
    const result = evaluateConstants(
      [
        { name: 'wrong-a', symbol: 'G', unit: 'm/s²' },
        { name: 'wrong-b', symbol: 'g', unit: 'm/s²' },
      ],
      [G_SPEC],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'partial', expectedIndex: 0, studentIndex: 1 });
  });

  it('extra student rows that match nothing → silently ignored', () => {
    const result = evaluateConstants(
      [
        { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
        { name: 'extra1', symbol: 'x', unit: '' },
        { name: 'extra2', symbol: 'y', unit: '' },
      ],
      [G_SPEC],
    );
    expect(result).toEqual([{ status: 'matched', expectedIndex: 0, studentIndex: 0 }]);
  });

  it('case-insensitive key match falls through when no exact match available', () => {
    // Single row with case-only-wrong symbol → pass 2b picks it as partial.
    const result = evaluateConstants(
      [{ name: 'tyngdeacceleration', symbol: 'G', unit: 'm/s²' }],
      [G_SPEC],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'partial', expectedIndex: 0, studentIndex: 0 });
    if (result[0].status === 'partial') {
      expect(result[0].errors.symbol).toEqual({ type: 'case-mismatch' });
    }
  });
});

describe('evaluateTable + isCorrect', () => {
  const fullExpected = {
    iv: { name: 'højde', symbol: 'h', unit: 'm' },
    dv: { name: 'tid', symbol: 't', unit: 's' },
  };

  it('all correct → isCorrect=true', () => {
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [],
      },
      fullExpected,
    );
    expect(report.iv).toEqual({});
    expect(report.dv).toEqual({});
    expect(report.constants).toBeUndefined();
    expect(isCorrect(report)).toBe(true);
  });

  it('one wrong cell → isCorrect=false', () => {
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'M' }, // case-mismatch on unit
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [],
      },
      fullExpected,
    );
    expect(report.iv.unit).toEqual({ type: 'case-mismatch' });
    expect(isCorrect(report)).toBe(false);
  });

  it('constants present in expected: missing constant → isCorrect=false', () => {
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [],
      },
      {
        ...fullExpected,
        constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
      },
    );
    expect(report.constants).toEqual([{ status: 'missing', expectedIndex: 0 }]);
    expect(isCorrect(report)).toBe(false);
  });

  it('partial constants prevent isCorrect', () => {
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [{ name: 'wrong-name', symbol: 'g', unit: 'm/s²' }],
      },
      {
        ...fullExpected,
        constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
      },
    );
    expect(report.constants?.[0].status).toBe('partial');
    expect(isCorrect(report)).toBe(false);
  });
});

describe('isCorrect — direct', () => {
  it('returns true on empty report', () => {
    expect(isCorrect({ iv: {}, dv: {} })).toBe(true);
  });

  it('returns false when iv has errors', () => {
    const errors: VariableRowErrors = { name: { type: 'empty' } };
    expect(isCorrect({ iv: errors, dv: {} })).toBe(false);
  });

  it('returns false when constants array has a non-matched entry', () => {
    expect(
      isCorrect({
        iv: {},
        dv: {},
        constants: [{ status: 'missing', expectedIndex: 0 }],
      }),
    ).toBe(false);
  });

  it('returns true when constants array is empty (no required)', () => {
    expect(isCorrect({ iv: {}, dv: {}, constants: [] })).toBe(true);
  });
});
