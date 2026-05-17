// Pure-helper unit tests for variableTableCorrectness. Covers the contract
// documented in the module header: trim policy, case-folding, three-pass
// constants matching, malformed-entry handling.
import {
  type ExpectedConstant,
  type ExpectedVariable,
  type VariableRowErrors,
  evaluateCell,
  evaluateConstants,
  evaluateRow,
  evaluateTable,
  hasNoRowErrors,
  isCorrect,
  refineCellError,
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

describe('refineCellError — refinement helper', () => {
  const ivExp: ExpectedVariable = { name: 'højde', symbol: 'h', unit: 'm' };
  const dvExp: ExpectedVariable = { name: 'tid', symbol: 't', unit: 's' };

  it('returns input unchanged when not mismatch', () => {
    expect(refineCellError(undefined, 'h', { cell: 'symbol', rowExpected: ivExp })).toBeUndefined();
    expect(
      refineCellError({ type: 'empty' }, '', { cell: 'symbol', rowExpected: ivExp }),
    ).toEqual({ type: 'empty' });
    expect(
      refineCellError({ type: 'case-mismatch' }, 'H', { cell: 'symbol', rowExpected: ivExp }),
    ).toEqual({ type: 'case-mismatch' });
  });

  describe('misplaced — sibling cell of same row', () => {
    it('value matching sibling unit → misplaced from unit', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 'm', { cell: 'symbol', rowExpected: ivExp }),
      ).toEqual({ type: 'misplaced', from: 'unit' });
    });

    it('value matching sibling name → misplaced from name (case-insensitive)', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 'Højde', { cell: 'symbol', rowExpected: ivExp }),
      ).toEqual({ type: 'misplaced', from: 'name' });
    });

    it('value matching sibling symbol → misplaced from symbol', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 'h', { cell: 'unit', rowExpected: ivExp }),
      ).toEqual({ type: 'misplaced', from: 'symbol' });
    });

    it('respects sibling cell case-sensitivity: M does NOT match sibling unit m', () => {
      // own cell symbol 'h' doesn't match 'M' even case-fold (would be 'm' ≠ 'h'),
      // so evaluateCell would return mismatch. Refinement tries siblings:
      // unit is case-sensitive, 'M' ≠ 'm' exactly, so no misplaced.
      expect(
        refineCellError({ type: 'mismatch' }, 'M', { cell: 'symbol', rowExpected: ivExp }),
      ).toEqual({ type: 'mismatch' });
    });

    it('skips own cell when scanning siblings', () => {
      // 'h' in symbol matches own cell — but refineCellError only sees a `mismatch`
      // input from upstream, so this scenario is hypothetical. The guard against
      // self-misplaced matters when own cell shares an accepted form with itself.
      const exp: ExpectedVariable = { symbol: 'h', unit: 'h' }; // synthetic
      expect(
        refineCellError({ type: 'mismatch' }, 'h', { cell: 'symbol', rowExpected: exp }),
      ).toEqual({ type: 'misplaced', from: 'unit' });
    });

    it('skips siblings that are not under check (undefined)', () => {
      const exp: ExpectedVariable = { symbol: 'h' }; // no name, no unit
      expect(
        refineCellError({ type: 'mismatch' }, 'm', { cell: 'symbol', rowExpected: exp }),
      ).toEqual({ type: 'mismatch' });
    });
  });

  describe('row-swapped — corresponding cell of other row', () => {
    it('IV symbol value matches DV symbol → row-swapped from dv', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 't', {
          cell: 'symbol',
          rowExpected: ivExp,
          otherRowExpected: dvExp,
          otherRowLabel: 'dv',
        }),
      ).toEqual({ type: 'row-swapped', from: 'dv' });
    });

    it('DV unit value matches IV unit → row-swapped from iv', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 'm', {
          cell: 'unit',
          rowExpected: dvExp,
          otherRowExpected: ivExp,
          otherRowLabel: 'iv',
        }),
      ).toEqual({ type: 'row-swapped', from: 'iv' });
    });

    it('does not fire when otherRowExpected is undefined (constants case)', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 't', { cell: 'symbol', rowExpected: ivExp }),
      ).toEqual({ type: 'mismatch' });
    });

    it('respects own cell case-sensitivity: T (capital) ≠ DV symbol t', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 'T', {
          cell: 'symbol',
          rowExpected: ivExp,
          otherRowExpected: dvExp,
          otherRowLabel: 'dv',
        }),
      ).toEqual({ type: 'mismatch' });
    });
  });

  describe('common-mistake — author-supplied wrong-answer list', () => {
    const exp: ExpectedVariable = {
      symbol: 'h',
      unit: 'm',
      commonMistakes: {
        unit: [
          { wrong: 'meter', kind: 'spelled-out-unit', hint: 'Brug symbolet.' },
          { wrong: ['CM', 'cm'], kind: 'wrong-prefix' },
        ],
      },
    };

    it('matches a single-string wrong value and emits kind + hint', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 'meter', {
          cell: 'unit',
          rowExpected: exp,
          commonMistakes: exp.commonMistakes?.unit,
        }),
      ).toEqual({ type: 'common-mistake', kind: 'spelled-out-unit', hint: 'Brug symbolet.' });
    });

    it('matches any value in a multi-wrong array', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 'cm', {
          cell: 'unit',
          rowExpected: exp,
          commonMistakes: exp.commonMistakes?.unit,
        }),
      ).toEqual({ type: 'common-mistake', kind: 'wrong-prefix' });
      expect(
        refineCellError({ type: 'mismatch' }, 'CM', {
          cell: 'unit',
          rowExpected: exp,
          commonMistakes: exp.commonMistakes?.unit,
        }),
      ).toEqual({ type: 'common-mistake', kind: 'wrong-prefix' });
    });

    it('omits hint key when CommonMistake has no hint', () => {
      const result = refineCellError({ type: 'mismatch' }, 'cm', {
        cell: 'unit',
        rowExpected: exp,
        commonMistakes: exp.commonMistakes?.unit,
      });
      expect(result).not.toHaveProperty('hint');
    });

    it('is case-sensitive on symbol/unit cells', () => {
      const symExp: ExpectedVariable = {
        symbol: 'h',
        commonMistakes: { symbol: [{ wrong: 'X', kind: 'random' }] },
      };
      // 'x' (lowercase) shouldn't match 'X' commonMistake on case-sensitive cell.
      expect(
        refineCellError({ type: 'mismatch' }, 'x', {
          cell: 'symbol',
          rowExpected: symExp,
          commonMistakes: symExp.commonMistakes?.symbol,
        }),
      ).toEqual({ type: 'mismatch' });
    });

    it('is case-insensitive on name cell', () => {
      const nameExp: ExpectedVariable = {
        name: 'højde',
        commonMistakes: { name: [{ wrong: 'distance', kind: 'english' }] },
      };
      expect(
        refineCellError({ type: 'mismatch' }, 'Distance', {
          cell: 'name',
          rowExpected: nameExp,
          commonMistakes: nameExp.commonMistakes?.name,
        }),
      ).toEqual({ type: 'common-mistake', kind: 'english' });
    });
  });

  describe('whitespace-internal — collapse-and-rematch', () => {
    it('matches own cell value after collapsing internal whitespace', () => {
      const exp: ExpectedVariable = { unit: 'm/s²' };
      expect(
        refineCellError({ type: 'mismatch' }, 'm / s²', { cell: 'unit', rowExpected: exp }),
      ).toEqual({ type: 'whitespace-internal' });
    });

    it('does not fire when collapse still does not match', () => {
      const exp: ExpectedVariable = { unit: 'm/s²' };
      expect(
        refineCellError({ type: 'mismatch' }, 'k g', { cell: 'unit', rowExpected: exp }),
      ).toEqual({ type: 'mismatch' });
    });

    it('respects case-sensitivity', () => {
      const exp: ExpectedVariable = { unit: 'm/s²' };
      // 'M / s²' collapses to 'M/s²' — case-sensitive cell, doesn't match.
      expect(
        refineCellError({ type: 'mismatch' }, 'M / s²', { cell: 'unit', rowExpected: exp }),
      ).toEqual({ type: 'mismatch' });
    });
  });

  describe('precedence', () => {
    const exp: ExpectedVariable = {
      symbol: 'h',
      unit: 'm',
      commonMistakes: { symbol: [{ wrong: 'm', kind: 'whatever' }] },
    };

    it('misplaced beats common-mistake (sibling match wins over author list)', () => {
      // 'm' matches both sibling unit and the commonMistake list — misplaced wins.
      expect(
        refineCellError({ type: 'mismatch' }, 'm', {
          cell: 'symbol',
          rowExpected: exp,
          commonMistakes: exp.commonMistakes?.symbol,
        }),
      ).toEqual({ type: 'misplaced', from: 'unit' });
    });

    it('misplaced beats row-swapped (same-row sibling wins over other-row corresponding)', () => {
      // Construct: IV symbol expected 'h', IV unit expected 't' (synthetic).
      // DV symbol expected 't' (same letter). Student types 't' in IV symbol —
      // matches IV's unit (misplaced) AND DV's symbol (row-swapped). misplaced wins.
      const ivSyn: ExpectedVariable = { symbol: 'h', unit: 't' };
      const dvSyn: ExpectedVariable = { symbol: 't' };
      expect(
        refineCellError({ type: 'mismatch' }, 't', {
          cell: 'symbol',
          rowExpected: ivSyn,
          otherRowExpected: dvSyn,
          otherRowLabel: 'dv',
        }),
      ).toEqual({ type: 'misplaced', from: 'unit' });
    });

    it('row-swapped beats common-mistake', () => {
      const ivWithCm: ExpectedVariable = {
        symbol: 'h',
        commonMistakes: { symbol: [{ wrong: 't', kind: 'whatever' }] },
      };
      expect(
        refineCellError({ type: 'mismatch' }, 't', {
          cell: 'symbol',
          rowExpected: ivWithCm,
          otherRowExpected: dvExp,
          otherRowLabel: 'dv',
          commonMistakes: ivWithCm.commonMistakes?.symbol,
        }),
      ).toEqual({ type: 'row-swapped', from: 'dv' });
    });

    it('common-mistake beats whitespace-internal', () => {
      const expWs: ExpectedVariable = {
        unit: 'm/s²',
        commonMistakes: { unit: [{ wrong: 'm / s²', kind: 'spaced-out' }] },
      };
      expect(
        refineCellError({ type: 'mismatch' }, 'm / s²', {
          cell: 'unit',
          rowExpected: expWs,
          commonMistakes: expWs.commonMistakes?.unit,
        }),
      ).toEqual({ type: 'common-mistake', kind: 'spaced-out' });
    });
  });
});

describe('evaluateTable — refinement integration', () => {
  const fullExpected = {
    iv: { name: 'højde', symbol: 'h', unit: 'm' },
    dv: { name: 'tid', symbol: 't', unit: 's' },
  };

  it('IV symbol = unit-of-IV → misplaced from unit', () => {
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'm', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [],
      },
      fullExpected,
    );
    expect(report.iv.symbol).toEqual({ type: 'misplaced', from: 'unit' });
  });

  it('IV symbol = DV symbol → row-swapped from dv', () => {
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 't', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [],
      },
      fullExpected,
    );
    expect(report.iv.symbol).toEqual({ type: 'row-swapped', from: 'dv' });
  });

  it('DV unit = IV unit → row-swapped from iv', () => {
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 'm' },
        constants: [],
      },
      fullExpected,
    );
    expect(report.dv.unit).toEqual({ type: 'row-swapped', from: 'iv' });
  });

  it('case-mismatch beats misplaced (own cell case-fold match wins)', () => {
    // Hypothetical lab where IV symbol is 'H' and unit is 'h'. Student types
    // 'h' in symbol → matches symbol case-fold (case-mismatch), and would
    // also misplaced-match the unit. case-mismatch wins (higher precedence).
    const exp = {
      iv: { name: 'højde', symbol: 'H', unit: 'h' },
      dv: { name: 'tid', symbol: 't', unit: 's' },
    };
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'h' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [],
      },
      exp,
    );
    expect(report.iv.symbol).toEqual({ type: 'case-mismatch' });
  });

  it('common-mistake on IV variable surfaces via expected.commonMistakes', () => {
    const expWithCm = {
      iv: {
        name: 'højde',
        symbol: 'h',
        unit: 'm',
        commonMistakes: {
          unit: [{ wrong: 'meter', kind: 'spelled-out-unit', hint: 'Brug symbolet.' }],
        },
      },
      dv: { name: 'tid', symbol: 't', unit: 's' },
    };
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'meter' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [],
      },
      expWithCm,
    );
    expect(report.iv.unit).toEqual({
      type: 'common-mistake',
      kind: 'spelled-out-unit',
      hint: 'Brug symbolet.',
    });
  });

  it('whitespace-internal on a constant unit (no row-swap context)', () => {
    const exp = {
      iv: { name: 'højde', symbol: 'h', unit: 'm' },
      dv: { name: 'tid', symbol: 't', unit: 's' },
      constants: [
        { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
      ] as ExpectedConstant[],
    };
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm / s²' }],
      },
      exp,
    );
    expect(report.constants).toHaveLength(1);
    const c = report.constants?.[0];
    expect(c?.status).toBe('partial');
    if (c?.status === 'partial') {
      expect(c.errors.unit).toEqual({ type: 'whitespace-internal' });
    }
  });

  it('row-swapped is NEVER offered on constants (no other-row context)', () => {
    // Two expected constants. Student fills the second one with the first
    // constant's symbol. That's a cross-constant swap — must NOT be flagged
    // as row-swapped (only iv/dv pair gets that). It can still be misplaced
    // within the matched expected row or fall through to mismatch.
    const exp = {
      iv: { name: 'højde', symbol: 'h', unit: 'm' },
      dv: { name: 'tid', symbol: 't', unit: 's' },
      constants: [
        { name: 'a', symbol: 'a', unit: 'au' },
        { name: 'b', symbol: 'b', unit: 'bu' },
      ] as ExpectedConstant[],
    };
    const report = evaluateTable(
      {
        iv: { name: 'højde', symbol: 'h', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
        // Student fills the row matching 'b' with symbol 'b' but unit 'au'
        // (constant a's unit). Should NOT be row-swapped.
        constants: [{ name: 'b', symbol: 'b', unit: 'au' }],
      },
      exp,
    );
    const partial = report.constants?.find((c) => c.status === 'partial');
    expect(partial).toBeDefined();
    if (partial?.status === 'partial') {
      // unit got 'au' which is constant-a's unit. Within constant-b's row,
      // 'au' is not a sibling and not a commonMistake, so it falls through
      // to mismatch — definitely not row-swapped.
      expect(partial.errors.unit?.type).not.toBe('row-swapped');
    }
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
