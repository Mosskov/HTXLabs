// @vitest-environment node
// Pure-helper unit tests for variableTableValues: bounds resolution, value
// rehydration from persisted state, filled/empty predicates, and expected-array
// clamping.
import {
  DEFAULT_CONSTANTS_BOUNDS,
  DEFAULT_IV_BOUNDS,
  cellKey,
  clampExpected,
  emptyRows,
  entryEmpty,
  entryFilled,
  readRows,
  readValues,
  resolveBounds,
  sectionFilled,
  valuesEqual,
} from '@/lab-guide/widgets/variableTableValues';
import { describe, expect, it, vi } from 'vitest';

const filledEntry = { name: 'højde', symbol: 'h', unit: 'm' };

describe('cellKey', () => {
  it('joins section, expected index, and cell with dots', () => {
    expect(cellKey('iv', 0, 'symbol')).toBe('iv.0.symbol');
    expect(cellKey('constants', 2, 'name')).toBe('constants.2.name');
  });
});

describe('resolveBounds', () => {
  it('returns the fallback when no config is given', () => {
    expect(resolveBounds(undefined, DEFAULT_IV_BOUNDS)).toEqual({ min: 1, max: 1 });
  });
  it('pins min and max to the same value for { count }', () => {
    expect(resolveBounds({ count: 3 }, DEFAULT_IV_BOUNDS)).toEqual({ min: 3, max: 3 });
  });
  it('passes { min, max } through', () => {
    expect(resolveBounds({ min: 1, max: 4 }, DEFAULT_IV_BOUNDS)).toEqual({ min: 1, max: 4 });
  });
});

describe('emptyRows', () => {
  it('builds n distinct empty entries', () => {
    const rows = emptyRows(2);
    expect(rows).toEqual([
      { name: '', symbol: '', unit: '' },
      { name: '', symbol: '', unit: '' },
    ]);
    // Distinct objects — a shared reference would alias edits across rows.
    expect(rows[0]).not.toBe(rows[1]);
  });
  it('returns [] for a non-finite count', () => {
    expect(emptyRows(Number.POSITIVE_INFINITY)).toEqual([]);
  });
  it('clamps negatives to []', () => {
    expect(emptyRows(-1)).toEqual([]);
  });
});

describe('readRows', () => {
  it('pads a short persisted array up to min', () => {
    expect(readRows([filledEntry], 2)).toEqual([filledEntry, { name: '', symbol: '', unit: '' }]);
  });
  it('fills missing cells on a partial persisted row', () => {
    expect(readRows([{ symbol: 'h' }], 1)).toEqual([{ name: '', symbol: 'h', unit: '' }]);
  });
  it('falls back to min empty rows for a non-array', () => {
    expect(readRows(undefined, 1)).toEqual([{ name: '', symbol: '', unit: '' }]);
    expect(readRows('nonsense', 0)).toEqual([]);
  });
  it('keeps rows beyond min', () => {
    expect(readRows([filledEntry, filledEntry], 1)).toHaveLength(2);
  });
});

describe('readValues', () => {
  const bounds = { iv: { min: 1, max: 1 }, dv: { min: 1, max: 1 }, constants: { min: 0, max: 5 } };

  it('rehydrates each section independently', () => {
    const out = readValues({ iv: [filledEntry] }, bounds);
    expect(out.iv).toEqual([filledEntry]);
    expect(out.dv).toEqual([{ name: '', symbol: '', unit: '' }]);
    expect(out.constants).toEqual([]);
  });
  it('returns min-sized empty sections for a non-object', () => {
    const out = readValues(null, bounds);
    expect(out.iv).toHaveLength(1);
    expect(out.dv).toHaveLength(1);
    expect(out.constants).toHaveLength(0);
  });
});

describe('entryFilled', () => {
  it('ignores the unit cell when requireUnits is false', () => {
    expect(entryFilled({ name: 'højde', symbol: 'h', unit: '' }, false)).toBe(true);
  });
  it('requires the unit cell when requireUnits is true', () => {
    expect(entryFilled({ name: 'højde', symbol: 'h', unit: '' }, true)).toBe(false);
    expect(entryFilled(filledEntry, true)).toBe(true);
  });
  it('treats whitespace-only as not filled', () => {
    expect(entryFilled({ name: '   ', symbol: 'h', unit: 'm' }, false)).toBe(false);
  });
});

describe('entryEmpty', () => {
  it('is true for blank and whitespace-only entries', () => {
    expect(entryEmpty({ name: '', symbol: '', unit: '' })).toBe(true);
    expect(entryEmpty({ name: ' ', symbol: '\t', unit: '  ' })).toBe(true);
  });
  it('is false when any cell has content', () => {
    expect(entryEmpty({ name: '', symbol: 'h', unit: '' })).toBe(false);
  });
});

describe('sectionFilled', () => {
  it('is false below min row count', () => {
    expect(sectionFilled([], { min: 1, max: 1 }, false)).toBe(false);
  });
  it('is false above a finite max row count', () => {
    expect(sectionFilled([filledEntry, filledEntry], { min: 1, max: 1 }, false)).toBe(false);
  });
  it('allows any count under an infinite max', () => {
    expect(sectionFilled([filledEntry, filledEntry], DEFAULT_CONSTANTS_BOUNDS, false)).toBe(true);
  });
  it('is false when any row is unfilled', () => {
    expect(sectionFilled([filledEntry, { name: '', symbol: '', unit: '' }], { min: 1, max: 2 }, false)).toBe(false);
  });
});

describe('valuesEqual', () => {
  it('compares structurally', () => {
    expect(valuesEqual([filledEntry], [{ ...filledEntry }])).toBe(true);
    expect(valuesEqual([filledEntry], [{ ...filledEntry, unit: 'cm' }])).toBe(false);
  });
});

describe('clampExpected', () => {
  it('returns the input unchanged when it fits', () => {
    const arr = [{ symbol: 'h' }];
    expect(clampExpected('w1', 'iv', arr, { min: 1, max: 1 })).toBe(arr);
  });
  it('returns the input unchanged under an infinite max', () => {
    const arr = [{ symbol: 'h' }, { symbol: 't' }];
    expect(clampExpected('w1', 'constants', arr, DEFAULT_CONSTANTS_BOUNDS)).toBe(arr);
  });
  it('truncates to max when the author oversupplied', () => {
    // PL14 guard: extra entries would be permanently unlockable — the student
    // physically cannot render enough rows to satisfy them.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const arr = [{ symbol: 'h' }, { symbol: 't' }, { symbol: 'v' }];
    expect(clampExpected('w1', 'iv', arr, { min: 1, max: 2 })).toEqual([{ symbol: 'h' }, { symbol: 't' }]);
    warn.mockRestore();
  });
});
