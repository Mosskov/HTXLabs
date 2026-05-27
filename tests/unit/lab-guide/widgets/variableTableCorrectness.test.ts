import type { VariableEntry } from '@/lab-guide/widgets/VariableTable';
// Pure-helper unit tests for variableTableCorrectness. Covers the contract
// documented in the module header: trim policy, case-folding, five-pass
// row-group matching (full / exact-key / case-insensitive-key / best-
// similarity / empty-row positional fallback), malformed-entry handling,
// and cross-section row-swap detection.
import {
  type ExpectedConstant,
  type ExpectedVariable,
  type ExpectedVariables,
  type RowMatch,
  type VariableRowErrors,
  asExpectedArray,
  evaluateCell,
  evaluateConstants,
  evaluateRow,
  evaluateRowGroup,
  evaluateTable,
  hasNoRowErrors,
  isCorrect,
  refineCellError,
} from '@/lab-guide/widgets/variableTableCorrectness';
import { describe, expect, it } from 'vitest';

const emptyEntry: VariableEntry = { name: '', symbol: '', unit: '' };

describe('asExpectedArray', () => {
  it('returns [] for undefined', () => {
    expect(asExpectedArray(undefined)).toEqual([]);
  });
  it('wraps a single object in a one-element array', () => {
    const obj = { symbol: 'h' };
    expect(asExpectedArray(obj)).toEqual([obj]);
  });
  it('returns arrays unchanged', () => {
    const arr = [{ symbol: 'h' }, { symbol: 't' }];
    expect(asExpectedArray(arr)).toBe(arr);
  });
});

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
      evaluateRow({ name: 'højde', symbol: 'h', unit: 'whatever' }, { name: 'højde', symbol: 'h' }),
    ).toEqual({});
  });

  it('all three cells omitted → {} (vacuously correct)', () => {
    expect(evaluateRow(emptyEntry, {})).toEqual({});
  });

  it('case-mismatch surfaces on symbol/unit only', () => {
    const errors = evaluateRow(
      { name: 'Højde', symbol: 'H', unit: 'M' },
      { name: 'højde', symbol: 'h', unit: 'm' },
    );
    expect(errors.name).toBeUndefined();
    expect(errors.symbol).toEqual({ type: 'case-mismatch' });
    expect(errors.unit).toEqual({ type: 'case-mismatch' });
  });
});

describe('evaluateRowGroup (constants)', () => {
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
    const result = evaluateConstants([{ name: 'gravity', symbol: 'g', unit: 'm/s²' }], [G_SPEC]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'partial', expectedIndex: 0, studentIndex: 0 });
    if (result[0].status === 'partial') {
      expect(result[0].errors.name).toEqual({ type: 'mismatch' });
    }
  });

  it('no student row mentions the symbol → positional fallback partial, then missing only when no student left', () => {
    // A non-matching student row falls through 3 key-passes to positional
    // fallback, where it pairs with G_SPEC and produces a partial.
    const result = evaluateConstants([{ name: 'fart', symbol: 'v', unit: 'm/s' }], [G_SPEC]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('partial');
  });

  it('empty student rows → missing', () => {
    expect(evaluateConstants([], [G_SPEC])).toEqual([{ status: 'missing', expectedIndex: 0 }]);
  });

  it('duplicate-symbol student rows: matcher picks the full match first', () => {
    const result = evaluateConstants(
      [
        { name: 'gravity', symbol: 'g', unit: 'm/s²' },
        { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
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
    const malformed = [{} as ExpectedConstant];
    expect(evaluateConstants([], malformed)).toEqual([]);
    expect(evaluateConstants([{ name: 'something', symbol: 's', unit: 'x' }], malformed)).toEqual(
      [],
    );
  });

  it('pass-2 priority: exact key match wins over case-insensitive within partial pass', () => {
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

  it('case-insensitive key match falls through when no exact match available', () => {
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

describe('evaluateRowGroup — similarity pass (bug 1 + bug 2 regression)', () => {
  const TWO_CONSTANTS: ExpectedConstant[] = [
    { name: 'hældning', symbol: 'a', unit: 'ua' },
    { name: 'skæringspunkt', symbol: 'b', unit: 'ub' },
  ];

  it('bug 1: right name + unit + wrong symbol → pair by similarity, only symbol errors', () => {
    // The first konstanter row is empty; the second carries the "right
    // name + unit but wrong symbol" payload. Without the similarity pass
    // the matcher would pair row 1 positionally to expected[1] and report
    // every cell wrong; with similarity, the score-2 hit on (name, unit)
    // wins and only `symbol` flashes.
    const student: VariableEntry[] = [
      { name: '', symbol: '', unit: '' },
      { name: 'skæringspunkt', symbol: 's', unit: 'ub' },
    ];
    const result = evaluateConstants(student, TWO_CONSTANTS);
    const byExpected = new Map(result.map((m) => [m.expectedIndex, m]));
    const m1 = byExpected.get(1);
    expect(m1).toMatchObject({ status: 'partial', studentIndex: 1 });
    if (m1?.status === 'partial') {
      expect(m1.errors.name).toBeUndefined();
      expect(m1.errors.unit).toBeUndefined();
      expect(m1.errors.symbol).toEqual({ type: 'mismatch' });
    }
  });

  it('bug 1: order-swapped konstanter (row 0 = second expected) → both matched', () => {
    const student: VariableEntry[] = [
      { name: 'skæringspunkt', symbol: 'b', unit: 'ub' },
      { name: 'hældning', symbol: 'a', unit: 'ua' },
    ];
    const result = evaluateConstants(student, TWO_CONSTANTS);
    const byExpected = new Map(result.map((m) => [m.expectedIndex, m]));
    expect(byExpected.get(0)).toMatchObject({ status: 'matched', studentIndex: 1 });
    expect(byExpected.get(1)).toMatchObject({ status: 'matched', studentIndex: 0 });
  });

  it('bug 2: type-then-delete row 0 + correct row 1 → row 0 not pinned to expected[0]', () => {
    // Reproduces the "row pinning" symptom: the student typed `hældning`
    // in row 0, then cleared it; meanwhile row 1 holds the correct second
    // entry. The matcher must pair row 1 to expected[1] by similarity,
    // leaving expected[0] to pair with the empty row 0 via the positional
    // fallback — surfacing only `empty` per-cell errors, never `mismatch`
    // against "hældning".
    const student: VariableEntry[] = [
      { name: '', symbol: '', unit: '' },
      { name: 'skæringspunkt', symbol: 'b', unit: 'ub' },
    ];
    const result = evaluateConstants(student, TWO_CONSTANTS);
    const byExpected = new Map(result.map((m) => [m.expectedIndex, m]));
    expect(byExpected.get(1)).toMatchObject({ status: 'matched', studentIndex: 1 });
    const m0 = byExpected.get(0);
    expect(m0).toBeDefined();
    if (m0?.status === 'partial') {
      for (const cell of ['name', 'symbol', 'unit'] as const) {
        const err = m0.errors[cell];
        if (err !== undefined) expect(err.type).toBe('empty');
      }
    }
  });

  it('similarity matches a row with only one cell in common', () => {
    // Single-cell hit is enough — name matches expected[1], symbol+unit blank.
    // Pass 2c pairs stu[0] with exp[1] (score=1); exp[0] then reports as
    // missing (no remaining students to fall through to in Pass 3).
    const student: VariableEntry[] = [{ name: 'skæringspunkt', symbol: '', unit: '' }];
    const result = evaluateConstants(student, TWO_CONSTANTS);
    const byExpected = new Map(result.map((m) => [m.expectedIndex, m]));
    expect(byExpected.get(1)).toMatchObject({ status: 'partial', studentIndex: 0 });
    expect(byExpected.get(0)).toEqual({ status: 'missing', expectedIndex: 0 });
  });
});

describe('evaluateRowGroup — uniform across sections', () => {
  it('works identically for IV/DV/constants (no opposite context)', () => {
    const exp: ExpectedVariable[] = [{ symbol: 'h' }];
    const correct: VariableEntry[] = [{ name: 'højde', symbol: 'h', unit: 'm' }];
    const wrong: VariableEntry[] = [{ name: 'foo', symbol: 'x', unit: 'y' }];
    expect(evaluateRowGroup(correct, exp)).toEqual([
      { status: 'matched', expectedIndex: 0, studentIndex: 0 },
    ]);
    const wrongResult = evaluateRowGroup(wrong, exp);
    expect(wrongResult).toHaveLength(1);
    expect(wrongResult[0].status).toBe('partial');
  });

  it('positional fallback pairs unpaired student row with unpaired expected at same position', () => {
    const exp: ExpectedVariable[] = [{ symbol: 'h' }];
    // Student row has no symbol but is non-empty in some other cell.
    const student: VariableEntry[] = [{ name: 'foo', symbol: '', unit: '' }];
    const result = evaluateRowGroup(student, exp);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'partial', expectedIndex: 0, studentIndex: 0 });
    if (result[0].status === 'partial') {
      expect(result[0].errors.symbol).toEqual({ type: 'empty' });
    }
  });
});

describe('cross-section row-swap detection', () => {
  it('single-row IV/DV regression: swap surfaces as row-swapped on the cell', () => {
    const report = evaluateTable(
      {
        iv: [{ name: 'højde', symbol: 't', unit: 'm' }], // symbol belongs to DV
        dv: [{ name: 'tid', symbol: 't', unit: 's' }],
        constants: [],
      },
      {
        iv: { name: 'højde', symbol: 'h', unit: 'm' },
        dv: { name: 'tid', symbol: 't', unit: 's' },
      },
    );
    const iv0 = report.iv[0];
    expect(iv0.status).toBe('partial');
    if (iv0.status === 'partial') {
      expect(iv0.errors.symbol).toEqual({ type: 'row-swapped', from: 'dv' });
    }
  });

  it('multi-row true swap: IV row holds value matching an unmatched DV entry → row-swapped', () => {
    const report = evaluateTable(
      {
        iv: [
          { name: 'højde', symbol: 'h', unit: 'm' },
          { name: 'tid', symbol: 't', unit: 's' }, // symbol belongs to DV-expected
        ],
        dv: [{ name: 'fart', symbol: 'v', unit: 'm/s' }],
        constants: [],
      },
      {
        iv: [
          { name: 'højde', symbol: 'h', unit: 'm' },
          { name: 'acceleration', symbol: 'a', unit: 'm/s²' },
        ],
        dv: [
          { name: 'fart', symbol: 'v', unit: 'm/s' },
          { name: 'tid', symbol: 't', unit: 's' },
        ],
      },
    );
    // Find the partial with row-swapped on symbol.
    const partial = report.iv.find((m) => m.status === 'partial');
    expect(partial).toBeDefined();
    if (partial?.status === 'partial') {
      expect(partial.errors.symbol).toEqual({ type: 'row-swapped', from: 'dv' });
    }
  });

  it('multi-row non-swap: IV value also defined on current-section expected → matches first, no false swap', () => {
    const report = evaluateTable(
      {
        iv: [
          { name: 'højde', symbol: 'h', unit: 'm' },
          { name: 'tid', symbol: 't', unit: 's' },
        ],
        dv: [{ name: 'fart', symbol: 'v', unit: 'm/s' }],
        constants: [],
      },
      {
        iv: [
          { name: 'højde', symbol: 'h', unit: 'm' },
          { name: 'tid', symbol: 't', unit: 's' },
        ],
        // dv has 't' too — would have been a swap-candidate had IV not also defined it.
        dv: [{ name: 'fart', symbol: 'v', unit: 'm/s' }],
      },
    );
    // Both IV rows matched cleanly — no row-swapped flag.
    for (const m of report.iv) {
      expect(m.status).toBe('matched');
    }
  });
});

describe('keyless / malformed expected', () => {
  it('keyless single-object expected.iv (e.g. { unit: "m" }) is dropped from matching', () => {
    const exp: ExpectedVariables = {
      iv: { unit: 'm' },
      dv: { symbol: 'v' },
    };
    const report = evaluateTable(
      {
        iv: [{ name: 'højde', symbol: 'h', unit: 'm' }],
        dv: [{ name: 'fart', symbol: 'v', unit: 'm/s' }],
        constants: [],
      },
      exp,
    );
    // No iv work-list entry → no row-matches, no `missing` either.
    expect(report.iv).toEqual([]);
  });

  it('PL10: constants-only expected typechecks + produces no IV/DV errors', () => {
    const exp: ExpectedVariables = {
      constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
    };
    const report = evaluateTable(
      {
        // Garbage IV/DV — should not produce any errors since iv/dv are
        // unconfigured.
        iv: [{ name: 'nonsense', symbol: 'x', unit: 'wat' }],
        dv: [{ name: 'rubbish', symbol: 'y', unit: 'huh' }],
        constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
      },
      exp,
    );
    expect(report.iv).toEqual([]);
    expect(report.dv).toEqual([]);
    expect(report.constants?.[0].status).toBe('matched');
  });
});

describe('evaluateTable + isCorrect', () => {
  const fullExpected: ExpectedVariables = {
    iv: { name: 'højde', symbol: 'h', unit: 'm' },
    dv: { name: 'tid', symbol: 't', unit: 's' },
  };

  it('all correct → isCorrect=true', () => {
    const report = evaluateTable(
      {
        iv: [{ name: 'højde', symbol: 'h', unit: 'm' }],
        dv: [{ name: 'tid', symbol: 't', unit: 's' }],
        constants: [],
      },
      fullExpected,
    );
    expect(report.iv[0].status).toBe('matched');
    expect(report.dv[0].status).toBe('matched');
    expect(report.constants).toBeUndefined();
    expect(isCorrect(report)).toBe(true);
  });

  it('one wrong cell → isCorrect=false', () => {
    const report = evaluateTable(
      {
        iv: [{ name: 'højde', symbol: 'h', unit: 'M' }],
        dv: [{ name: 'tid', symbol: 't', unit: 's' }],
        constants: [],
      },
      fullExpected,
    );
    const iv0 = report.iv[0];
    expect(iv0.status).toBe('partial');
    if (iv0.status === 'partial') {
      expect(iv0.errors.unit).toEqual({ type: 'case-mismatch' });
    }
    expect(isCorrect(report)).toBe(false);
  });

  it('constants present in expected: missing constant → isCorrect=false', () => {
    const report = evaluateTable(
      {
        iv: [{ name: 'højde', symbol: 'h', unit: 'm' }],
        dv: [{ name: 'tid', symbol: 't', unit: 's' }],
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
        iv: [{ name: 'højde', symbol: 'h', unit: 'm' }],
        dv: [{ name: 'tid', symbol: 't', unit: 's' }],
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
    expect(refineCellError({ type: 'empty' }, '', { cell: 'symbol', rowExpected: ivExp })).toEqual({
      type: 'empty',
    });
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
  });

  describe('row-swapped — corresponding cell of opposite section', () => {
    it('IV symbol value matches a DV expected → row-swapped from dv', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 't', {
          cell: 'symbol',
          rowExpected: ivExp,
          otherRowExpecteds: [dvExp],
          otherRowLabel: 'dv',
        }),
      ).toEqual({ type: 'row-swapped', from: 'dv' });
    });

    it('matches any opposite entry in an array (multi-DV)', () => {
      const dvArr = [{ symbol: 'v' }, { symbol: 't' }];
      expect(
        refineCellError({ type: 'mismatch' }, 't', {
          cell: 'symbol',
          rowExpected: ivExp,
          otherRowExpecteds: dvArr,
          otherRowLabel: 'dv',
        }),
      ).toEqual({ type: 'row-swapped', from: 'dv' });
    });

    it('does not fire when otherRowExpecteds is empty', () => {
      expect(
        refineCellError({ type: 'mismatch' }, 't', {
          cell: 'symbol',
          rowExpected: ivExp,
          otherRowExpecteds: [],
          otherRowLabel: 'dv',
        }),
      ).toEqual({ type: 'mismatch' });
    });
  });

  describe('common-mistake', () => {
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
  });

  describe('whitespace-internal', () => {
    it('matches own cell value after collapsing internal whitespace', () => {
      const exp: ExpectedVariable = { unit: 'm/s²' };
      expect(
        refineCellError({ type: 'mismatch' }, 'm / s²', { cell: 'unit', rowExpected: exp }),
      ).toEqual({ type: 'whitespace-internal' });
    });
  });

  describe('precedence', () => {
    it('misplaced beats common-mistake', () => {
      const exp: ExpectedVariable = {
        symbol: 'h',
        unit: 'm',
        commonMistakes: { symbol: [{ wrong: 'm', kind: 'whatever' }] },
      };
      expect(
        refineCellError({ type: 'mismatch' }, 'm', {
          cell: 'symbol',
          rowExpected: exp,
          commonMistakes: exp.commonMistakes?.symbol,
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
          otherRowExpecteds: [dvExp],
          otherRowLabel: 'dv',
          commonMistakes: ivWithCm.commonMistakes?.symbol,
        }),
      ).toEqual({ type: 'row-swapped', from: 'dv' });
    });
  });
});

describe('isCorrect — direct', () => {
  it('returns true on empty arrays', () => {
    expect(isCorrect({ iv: [], dv: [] })).toBe(true);
  });

  it('returns false when iv has a non-matched entry', () => {
    const errors: VariableRowErrors = { name: { type: 'empty' } };
    const m: RowMatch = { status: 'partial', expectedIndex: 0, studentIndex: 0, errors };
    expect(isCorrect({ iv: [m], dv: [] })).toBe(false);
  });

  it('returns false when constants array has a non-matched entry', () => {
    expect(
      isCorrect({
        iv: [],
        dv: [],
        constants: [{ status: 'missing', expectedIndex: 0 }],
      }),
    ).toBe(false);
  });

  it('returns true when constants array is empty', () => {
    expect(isCorrect({ iv: [], dv: [], constants: [] })).toBe(true);
  });
});
