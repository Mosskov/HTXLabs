// @vitest-environment node
// Pure-helper unit tests for variableTableHints. Covers the gating rules
// documented in VariableTable's header: paid tiers advance only on a clean
// section, free diagnostics surface only on a clean section, and already-paid
// reveals survive any subsequent edit — including clearing the cell.
import type { CorrectnessReport } from '@/lab-guide/widgets/variableTableCorrectness';
import {
  type HintCtx,
  cellInfoFor,
  countSpendable,
  freeDiagnosticFor,
  missingMessagesFor,
  resolveSpend,
} from '@/lab-guide/widgets/variableTableHints';
import type { VariableTableValues } from '@/lab-guide/widgets/variableTableValues';
import { describe, expect, it } from 'vitest';

const clean: HintCtx = {
  hasExpected: true,
  tiers: {},
  reveals: {},
  sectionClean: { iv: true, dv: true, constants: true },
};
const dirty: HintCtx = { ...clean, sectionClean: { iv: false, dv: false, constants: false } };

const expectedIv = [{ symbol: 'h' }];
const symbolWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'mismatch' } } }],
  dv: [],
};
const caseWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'case-mismatch' } } }],
  dv: [],
};

describe('freeDiagnosticFor', () => {
  it('returns text for the two free diagnostic error types', () => {
    expect(freeDiagnosticFor({ type: 'case-mismatch' }, 'symbol')).toBeTypeOf('string');
    expect(freeDiagnosticFor({ type: 'whitespace-internal' }, 'symbol')).toBeTypeOf('string');
  });
  it('returns null for paid error types and for no error', () => {
    expect(freeDiagnosticFor({ type: 'mismatch' }, 'symbol')).toBeNull();
    expect(freeDiagnosticFor(undefined, 'symbol')).toBeNull();
  });
});

describe('cellInfoFor', () => {
  it('returns the empty info when no answer key is configured', () => {
    const ctx: HintCtx = { ...clean, hasExpected: false };
    expect(cellInfoFor(ctx, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol')).toEqual({
      cap: 0,
      nextTier: null,
      freeDiagnostic: null,
      popupEntries: [],
    });
  });

  it('offers tier 1 on a failing cell in a clean section', () => {
    const info = cellInfoFor(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol');
    expect(info.cap).toBeGreaterThan(0);
    expect(info.nextTier).toBe(1);
  });

  it('offers no tier mid-edit', () => {
    // Spending mid-edit would charge for a hint about an error that may shift
    // on the next keystroke.
    expect(cellInfoFor(dirty, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').nextTier).toBeNull();
  });

  it('offers no tier once the ladder is exhausted', () => {
    const cap = cellInfoFor(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').cap;
    const capped: HintCtx = { ...clean, tiers: { 'iv.0.symbol': cap } };
    expect(cellInfoFor(capped, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').nextTier).toBeNull();
  });

  it('surfaces a free diagnostic only on a clean section', () => {
    expect(cellInfoFor(clean, 'iv', expectedIv, caseWrong.iv, 0, 'symbol').freeDiagnostic).toBeTypeOf('string');
    expect(cellInfoFor(dirty, 'iv', expectedIv, caseWrong.iv, 0, 'symbol').freeDiagnostic).toBeNull();
  });

  it('keeps paid reveals visible even mid-edit', () => {
    // Once spent, the hint is paid for and stays readable through every later
    // edit, including clearing the cell to retry.
    const ctx: HintCtx = { ...dirty, reveals: { 'iv.0.symbol': ['betalt hint'] } };
    const info = cellInfoFor(ctx, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol');
    expect(info.popupEntries.map((e) => e.text)).toContain('betalt hint');
  });

  it('orders free diagnostics before paid reveals', () => {
    const ctx: HintCtx = { ...clean, reveals: { 'iv.0.symbol': ['betalt hint'] } };
    const info = cellInfoFor(ctx, 'iv', expectedIv, caseWrong.iv, 0, 'symbol');
    expect(info.popupEntries[0]?.tone).toBe('misconception');
    expect(info.popupEntries.at(-1)?.tone).toBe('hint');
  });

  it('falls back to expectedIndex = studentIndex when the matcher finds no pairing', () => {
    // Documented limitation: correct for single-row sections, known-imperfect
    // for multi-row sections that reshuffle pairing. Must not be "fixed" here.
    const ctx: HintCtx = { ...clean, reveals: { 'iv.0.symbol': ['betalt hint'] } };
    const info = cellInfoFor(ctx, 'iv', expectedIv, undefined, 0, 'symbol');
    expect(info.popupEntries.map((e) => e.text)).toContain('betalt hint');
  });
});

describe('countSpendable', () => {
  const values: VariableTableValues = { iv: [{ name: '', symbol: 'x', unit: '' }], dv: [], constants: [] };
  const expected = { iv: expectedIv, dv: [], constants: [] };

  it('counts cells with a remaining ladder', () => {
    expect(countSpendable(clean, values, symbolWrong, expected)).toBe(1);
  });
  it('counts nothing mid-edit', () => {
    expect(countSpendable(dirty, values, symbolWrong, expected)).toBe(0);
  });
});

describe('resolveSpend', () => {
  it('returns the spend payload for a failing cell with a remaining tier', () => {
    const out = resolveSpend(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol');
    expect(out?.cellKey).toBe('iv.0.symbol');
    expect(out?.revealedText).toBeTypeOf('string');
    expect(out?.hintCap).toBeGreaterThan(0);
  });
  it('returns null for a cell with no error', () => {
    expect(resolveSpend(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'name')).toBeNull();
  });
  it('returns null once the ladder is exhausted', () => {
    const cap = cellInfoFor(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').cap;
    const capped: HintCtx = { ...clean, tiers: { 'iv.0.symbol': cap } };
    expect(resolveSpend(capped, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol')).toBeNull();
  });
  it('returns null when there is no matcher pairing', () => {
    expect(resolveSpend(clean, 'iv', expectedIv, undefined, 0, 'symbol')).toBeNull();
  });
});

describe('missingMessagesFor', () => {
  const missing: CorrectnessReport = {
    iv: [
      { status: 'missing', expectedIndex: 0 },
      { status: 'missing', expectedIndex: 1 },
    ],
    dv: [],
  };
  const twoExpected = [{ symbol: 'h' }, { symbol: 't' }];

  it('caps output at one message per section', () => {
    // Deliberate anti-spam cap — two missing rows still yield one message.
    expect(missingMessagesFor(clean, 'iv', twoExpected, missing.iv, '{symbol} mangler')).toEqual(['h mangler']);
  });
  it('returns nothing mid-edit', () => {
    expect(missingMessagesFor(dirty, 'iv', twoExpected, missing.iv, '{symbol} mangler')).toEqual([]);
  });
  it('returns nothing without an expected array', () => {
    expect(missingMessagesFor(clean, 'iv', undefined, missing.iv, '{symbol} mangler')).toEqual([]);
  });
});
