// Pure matching helpers + error taxonomy for VariableTable correctness checking.
// Internal to the VariableTable widget — not exported via widgets/index.ts or
// mdx.ts. The gate engine sees only the `correct: boolean` projection; the
// structured error payload is opaque (`unknown`) to gates.ts.
//
// Matching contract:
// - Trim leading/trailing whitespace only — no internal-whitespace collapse.
// - Names: case-insensitive (toLowerCase); plain Danish case-folding suffices.
// - Symbols/units: case-sensitive; case-only mismatch reported separately.
// - Constants: order-independent, three sub-passes (full > exact-key partial >
//   case-insensitive-key partial); each student row used at most once.
//   Matching key is `symbol` if set, else `name`. Malformed entries (neither
//   set) are silently dropped — never produce `missing`, so a misauthored lab
//   cannot permanently lock the gate. The widget warns in dev separately.
import type { VariableEntry } from './VariableTable';

export interface ExpectedVariable {
  name?: string | string[];
  symbol?: string | string[];
  unit?: string | string[];
}

// Constants must have at least one matching key. TS-level enforcement; the
// runtime helper still defensively skips malformed entries as a safety net.
export type ExpectedConstant =
  | { symbol: string | string[]; name?: string | string[]; unit?: string | string[] }
  | { name: string | string[]; symbol?: string | string[]; unit?: string | string[] };

export interface ExpectedVariables {
  iv: ExpectedVariable;
  dv: ExpectedVariable;
  constants?: ExpectedConstant[];
}

export type CellError = { type: 'empty' } | { type: 'mismatch' } | { type: 'case-mismatch' };

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

export function asArray(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
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
          errors: evaluateRow(row, exp),
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
          errors: evaluateRow(row, exp),
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
  const report: CorrectnessReport = {
    iv: evaluateRow(values.iv, expected.iv),
    dv: evaluateRow(values.dv, expected.dv),
  };
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
