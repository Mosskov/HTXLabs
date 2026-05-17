// Pure matching helpers + error taxonomy for VariableTable correctness checking.
// Internal to the VariableTable widget — not exported via widgets/index.ts or
// mdx.ts. The gate engine sees only the `correct: boolean` projection; the
// structured error payload is opaque (`unknown`) to gates.ts.
//
// Matching contract:
// - Trim leading/trailing whitespace only — no internal-whitespace collapse
//   on the primary match (the `whitespace-internal` refinement opts in).
// - Names: case-insensitive (toLowerCase); plain Danish case-folding suffices.
// - Symbols/units: case-sensitive; case-only mismatch reported separately.
// - Constants: order-independent, three sub-passes (full > exact-key partial >
//   case-insensitive-key partial); each student row used at most once.
//   Matching key is `symbol` if set, else `name`. Malformed entries (neither
//   set) are silently dropped — never produce `missing`, so a misauthored lab
//   cannot permanently lock the gate. The widget warns in dev separately.
//
// Error precedence (each cell reports its first hit):
//   1. exact match            → undefined
//   2. case-mismatch          (symbol/unit only)
//   3. misplaced              sibling cell of same row matches
//   4. row-swapped            corresponding cell of OTHER row matches (IV/DV)
//   5. common-mistake         author-supplied wrong-answer list
//   6. whitespace-internal    match after collapsing internal whitespace
//   7. mismatch               fallthrough
//
// `evaluateCell` produces only kinds 1, 2, 7 (and `empty`). Refinement into
// kinds 3–6 happens at the table/constants level via `refineCellError`, where
// the full row + optional other-row context is available. Direct callers of
// `evaluateRow` get the raw row result; refinement is applied by
// `evaluateTable` and inside `evaluateConstants` for partial matches.
import type { VariableEntry } from './VariableTable';

export type Cell = 'name' | 'symbol' | 'unit';

export interface CommonMistake {
  wrong: string | string[];
  kind: string;
  hint?: string;
}

export type CommonMistakes = Partial<Record<Cell, CommonMistake[]>>;

export interface ExpectedVariable {
  name?: string | string[];
  symbol?: string | string[];
  unit?: string | string[];
  commonMistakes?: CommonMistakes;
}

// Constants must have at least one matching key. TS-level enforcement; the
// runtime helper still defensively skips malformed entries as a safety net.
export type ExpectedConstant =
  | {
      symbol: string | string[];
      name?: string | string[];
      unit?: string | string[];
      commonMistakes?: CommonMistakes;
    }
  | {
      name: string | string[];
      symbol?: string | string[];
      unit?: string | string[];
      commonMistakes?: CommonMistakes;
    };

export interface ExpectedVariables {
  iv: ExpectedVariable;
  dv: ExpectedVariable;
  constants?: ExpectedConstant[];
}

export type CellError =
  | { type: 'empty' }
  | { type: 'mismatch' }
  | { type: 'case-mismatch' }
  | { type: 'misplaced'; from: Cell }
  | { type: 'row-swapped'; from: 'iv' | 'dv' }
  | { type: 'common-mistake'; kind: string; hint?: string }
  | { type: 'whitespace-internal' };

export interface VariableRowErrors {
  name?: CellError;
  symbol?: CellError;
  unit?: CellError;
}

export type ConstantMatch =
  | { status: 'missing'; expectedIndex: number }
  | { status: 'matched'; expectedIndex: number; studentIndex: number }
  | {
      status: 'partial';
      expectedIndex: number;
      studentIndex: number;
      errors: VariableRowErrors;
    };

export interface CorrectnessReport {
  iv: VariableRowErrors;
  dv: VariableRowErrors;
  constants?: ConstantMatch[];
}

const CELLS: readonly Cell[] = ['name', 'symbol', 'unit'];

export function asArray(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}

function isCaseSensitive(cell: Cell): boolean {
  return cell !== 'name';
}

function cellAccepted(exp: ExpectedVariable | ExpectedConstant, cell: Cell): string[] | undefined {
  const v = exp[cell];
  return v !== undefined ? asArray(v) : undefined;
}

/** True iff `value` (trimmed) matches any accepted form using the given
 *  case rule. Each accepted form is also trimmed. */
function valueMatches(value: string, accepted: string[], caseSensitive: boolean): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (caseSensitive) return accepted.some((a) => a.trim() === trimmed);
  const lower = trimmed.toLowerCase();
  return accepted.some((a) => a.trim().toLowerCase() === lower);
}

/** True iff `value` matches any accepted form after collapsing internal
 *  whitespace on both sides. Used for the `whitespace-internal` refinement
 *  (e.g. student typed `m / s²` for `m/s²`). */
function valueMatchesAfterCollapse(
  value: string,
  accepted: string[],
  caseSensitive: boolean,
): boolean {
  const collapsed = value.trim().replace(/\s+/g, '');
  if (collapsed.length === 0) return false;
  if (caseSensitive) {
    return accepted.some((a) => a.trim().replace(/\s+/g, '') === collapsed);
  }
  const lower = collapsed.toLowerCase();
  return accepted.some((a) => a.trim().replace(/\s+/g, '').toLowerCase() === lower);
}

/** Returns undefined when the cell is not under check (accepted=undefined),
 *  or when the value matches one of the accepted forms. */
export function evaluateCell(
  value: string,
  accepted: string[] | undefined,
  caseSensitive: boolean,
): CellError | undefined {
  if (accepted === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return { type: 'empty' };

  if (caseSensitive) {
    if (accepted.some((a) => a.trim() === trimmed)) return undefined;
    const lower = trimmed.toLowerCase();
    if (accepted.some((a) => a.trim().toLowerCase() === lower)) {
      return { type: 'case-mismatch' };
    }
    return { type: 'mismatch' };
  }

  const lower = trimmed.toLowerCase();
  if (accepted.some((a) => a.trim().toLowerCase() === lower)) return undefined;
  return { type: 'mismatch' };
}

export interface RefineContext {
  cell: Cell;
  rowExpected: ExpectedVariable | ExpectedConstant;
  /** When set, enables `row-swapped` detection against the other row. */
  otherRowExpected?: ExpectedVariable;
  /** Label of the other row, used in the `row-swapped` payload. */
  otherRowLabel?: 'iv' | 'dv';
  /** Pre-resolved common-mistakes list for this cell. */
  commonMistakes?: CommonMistake[];
}

/** Refine a raw `mismatch` into the most specific kind that fits. Returns the
 *  input unchanged when it is not `mismatch`. Pure. Precedence follows the
 *  module-header chain. */
export function refineCellError(
  current: CellError | undefined,
  value: string,
  ctx: RefineContext,
): CellError | undefined {
  if (current?.type !== 'mismatch') return current;

  // 3. misplaced — value matches a *sibling* cell of the same row.
  for (const sibling of CELLS) {
    if (sibling === ctx.cell) continue;
    const accepted = cellAccepted(ctx.rowExpected, sibling);
    if (accepted === undefined) continue;
    if (valueMatches(value, accepted, isCaseSensitive(sibling))) {
      return { type: 'misplaced', from: sibling };
    }
  }

  // 4. row-swapped — value matches the *corresponding* cell of the other row.
  if (ctx.otherRowExpected !== undefined && ctx.otherRowLabel !== undefined) {
    const accepted = cellAccepted(ctx.otherRowExpected, ctx.cell);
    if (accepted !== undefined && valueMatches(value, accepted, isCaseSensitive(ctx.cell))) {
      return { type: 'row-swapped', from: ctx.otherRowLabel };
    }
  }

  // 5. common-mistake — author-supplied wrong-answer list.
  if (ctx.commonMistakes !== undefined) {
    for (const cm of ctx.commonMistakes) {
      const wrongs = asArray(cm.wrong);
      if (valueMatches(value, wrongs, isCaseSensitive(ctx.cell))) {
        return cm.hint !== undefined
          ? { type: 'common-mistake', kind: cm.kind, hint: cm.hint }
          : { type: 'common-mistake', kind: cm.kind };
      }
    }
  }

  // 6. whitespace-internal — match after collapsing internal whitespace.
  const ownAccepted = cellAccepted(ctx.rowExpected, ctx.cell);
  if (
    ownAccepted !== undefined &&
    valueMatchesAfterCollapse(value, ownAccepted, isCaseSensitive(ctx.cell))
  ) {
    return { type: 'whitespace-internal' };
  }

  // 7. fallthrough — keep original mismatch.
  return current;
}

/** Apply `refineCellError` to each cell of a row. Mutates `errors` in place
 *  and returns it for chaining. */
function refineRow(
  errors: VariableRowErrors,
  entry: VariableEntry,
  rowExpected: ExpectedVariable | ExpectedConstant,
  otherRowExpected: ExpectedVariable | undefined,
  otherRowLabel: 'iv' | 'dv' | undefined,
): VariableRowErrors {
  const commonMistakes = rowExpected.commonMistakes;
  for (const cell of CELLS) {
    const refined = refineCellError(errors[cell], entry[cell], {
      cell,
      rowExpected,
      otherRowExpected,
      otherRowLabel,
      commonMistakes: commonMistakes?.[cell],
    });
    if (refined === undefined) {
      delete errors[cell];
    } else {
      errors[cell] = refined;
    }
  }
  return errors;
}

export function hasNoRowErrors(errors: VariableRowErrors): boolean {
  return errors.name === undefined && errors.symbol === undefined && errors.unit === undefined;
}

export function evaluateRow(entry: VariableEntry, expected: ExpectedVariable): VariableRowErrors {
  const errors: VariableRowErrors = {};
  const name = evaluateCell(
    entry.name,
    expected.name !== undefined ? asArray(expected.name) : undefined,
    false,
  );
  if (name) errors.name = name;
  const symbol = evaluateCell(
    entry.symbol,
    expected.symbol !== undefined ? asArray(expected.symbol) : undefined,
    true,
  );
  if (symbol) errors.symbol = symbol;
  const unit = evaluateCell(
    entry.unit,
    expected.unit !== undefined ? asArray(expected.unit) : undefined,
    true,
  );
  if (unit) errors.unit = unit;
  return errors;
}

/** Returns the matching-key accepted values for an expected constant — symbol
 *  if set, else name. Returns undefined when neither is set (malformed entry,
 *  filtered out by evaluateConstants). */
function matchingKey(expected: ExpectedConstant): string[] | undefined {
  if (expected.symbol !== undefined) return asArray(expected.symbol);
  if (expected.name !== undefined) return asArray(expected.name);
  return undefined;
}

/** Returns the student entry's value for the matching key (symbol if expected
 *  has symbol set; else name). */
function studentKey(entry: VariableEntry, expected: ExpectedConstant): string {
  return expected.symbol !== undefined ? entry.symbol : entry.name;
}

export function evaluateConstants(
  student: VariableEntry[],
  expected: ExpectedConstant[],
): ConstantMatch[] {
  // Build the work list: { expectedIndex, expected } for entries with a
  // matching key. Malformed entries (neither symbol nor name set) drop out.
  const work: Array<{ idx: number; exp: ExpectedConstant; key: string[] }> = [];
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
    if (exp === undefined) continue;
    const key = matchingKey(exp);
    if (key === undefined) continue;
    work.push({ idx: i, exp, key });
  }

  const used = new Set<number>();
  const result: ConstantMatch[] = [];
  const remaining = new Set(work.map((w) => w.idx));

  // Pass 1 — full match: student row evaluates with no errors.
  for (const { idx, exp } of work) {
    for (let s = 0; s < student.length; s++) {
      if (used.has(s)) continue;
      const row = student[s];
      if (row === undefined) continue;
      if (hasNoRowErrors(evaluateRow(row, exp))) {
        result.push({ status: 'matched', expectedIndex: idx, studentIndex: s });
        used.add(s);
        remaining.delete(idx);
        break;
      }
    }
  }

  // Pass 2a — exact key match (trimmed, case-sensitive on key).
  for (const { idx, exp, key } of work) {
    if (!remaining.has(idx)) continue;
    for (let s = 0; s < student.length; s++) {
      if (used.has(s)) continue;
      const row = student[s];
      if (row === undefined) continue;
      const sk = studentKey(row, exp).trim();
      if (key.some((k) => k.trim() === sk)) {
        result.push({
          status: 'partial',
          expectedIndex: idx,
          studentIndex: s,
          errors: refineRow(evaluateRow(row, exp), row, exp, undefined, undefined),
        });
        used.add(s);
        remaining.delete(idx);
        break;
      }
    }
  }

  // Pass 2b — case-insensitive key match.
  for (const { idx, exp, key } of work) {
    if (!remaining.has(idx)) continue;
    for (let s = 0; s < student.length; s++) {
      if (used.has(s)) continue;
      const row = student[s];
      if (row === undefined) continue;
      const sk = studentKey(row, exp).trim().toLowerCase();
      if (key.some((k) => k.trim().toLowerCase() === sk)) {
        result.push({
          status: 'partial',
          expectedIndex: idx,
          studentIndex: s,
          errors: refineRow(evaluateRow(row, exp), row, exp, undefined, undefined),
        });
        used.add(s);
        remaining.delete(idx);
        break;
      }
    }
  }

  // Whatever's still in remaining → missing.
  for (const { idx } of work) {
    if (remaining.has(idx)) {
      result.push({ status: 'missing', expectedIndex: idx });
    }
  }

  // Sort by expectedIndex for stable output order.
  result.sort((a, b) => a.expectedIndex - b.expectedIndex);
  return result;
}

export function evaluateTable(
  values: { iv: VariableEntry; dv: VariableEntry; constants: VariableEntry[] },
  expected: ExpectedVariables,
): CorrectnessReport {
  const ivErrors = refineRow(
    evaluateRow(values.iv, expected.iv),
    values.iv,
    expected.iv,
    expected.dv,
    'dv',
  );
  const dvErrors = refineRow(
    evaluateRow(values.dv, expected.dv),
    values.dv,
    expected.dv,
    expected.iv,
    'iv',
  );
  const report: CorrectnessReport = { iv: ivErrors, dv: dvErrors };
  if (expected.constants !== undefined) {
    report.constants = evaluateConstants(values.constants, expected.constants);
  }
  return report;
}

export function isCorrect(report: CorrectnessReport): boolean {
  if (!hasNoRowErrors(report.iv)) return false;
  if (!hasNoRowErrors(report.dv)) return false;
  if (report.constants) {
    for (const c of report.constants) {
      if (c.status !== 'matched') return false;
    }
  }
  return true;
}
